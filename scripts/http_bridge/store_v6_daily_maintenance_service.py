from __future__ import annotations

import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from .operation_locks import finish_operation, wait_start_operation
from .store_v5_status_service import utc_now_iso
from .store_v6_daily_maintenance_log import (
    append_event as append_maintenance_event,
    get_record as get_maintenance_record,
    read_events as read_maintenance_events,
    read_ledger as read_maintenance_ledger,
    update_ledger as update_maintenance_ledger,
)

AGGREGATE_TIMEFRAMES_DEFAULT = ["M5", "M15", "M30", "H1", "H2", "H4", "D1", "W1", "MN"]
MAINTENANCE_TIMEZONE = ZoneInfo("Asia/Shanghai")
MAINTENANCE_HOUR = 6
RUNNING_TIMEOUT_SECONDS = 6 * 60 * 60

_LOCK = threading.RLock()
_SCHEDULER_STARTED = False


def _now_local() -> datetime:
    return datetime.now(MAINTENANCE_TIMEZONE).replace(microsecond=0)


def _today_key() -> str:
    return _now_local().date().isoformat()


def _read_ledger(store_root: Path | None) -> dict[str, Any]:
    return read_maintenance_ledger(store_root)


def _append_event(store_root: Path | None, event: dict[str, Any]) -> dict[str, Any]:
    return append_maintenance_event(store_root, event, utc_now_iso=utc_now_iso)


def _update_ledger(store_root: Path | None, date: str, symbol: str, updates: dict[str, Any]) -> dict[str, Any]:
    return update_maintenance_ledger(store_root, date, symbol, updates, utc_now_iso=utc_now_iso)


def _get_record(store_root: Path | None, date: str, symbol: str) -> dict[str, Any] | None:
    return get_maintenance_record(store_root, date, symbol)


def _is_running_expired(record: dict[str, Any]) -> bool:
    if record.get("status") != "running":
        return False
    started_at = str(record.get("startedAt") or "")
    try:
        started = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
    except ValueError:
        return True
    return (datetime.now(timezone.utc) - started.astimezone(timezone.utc)).total_seconds() > RUNNING_TIMEOUT_SECONDS


def list_maintenance_symbols(store_root: Path | None = None) -> list[str]:
    from python.data_warehouse.store_v6.manifest_v6 import load_manifest_v6
    from python.data_warehouse.store_v6.paths_v6 import resolve_store_root

    root = resolve_store_root(store_root)
    manifest = load_manifest_v6(root)
    symbols = {
        str(cell.get("symbol") or "").strip()
        for cell in manifest.get("datasets", {}).values()
        if cell.get("provider") == "mt5" and str(cell.get("symbol") or "").strip()
    }
    return sorted(symbols)


def daily_maintenance_status(symbol: str | None = None, *, store_root: Path | None = None) -> dict[str, Any]:
    ledger = _read_ledger(store_root)
    records = list(ledger.get("records", {}).values())
    if symbol:
        records = [record for record in records if isinstance(record, dict) and record.get("symbol") == symbol]
    return {
        "ok": True,
        "status": "store_v6_daily_maintenance_status",
        "today": _today_key(),
        "maintenanceHour": MAINTENANCE_HOUR,
        "timezone": str(MAINTENANCE_TIMEZONE),
        "records": records,
        "updatedAt": ledger.get("updatedAt"),
    }


def daily_maintenance_events(symbol: str | None = None, *, store_root: Path | None = None, limit: int = 200) -> dict[str, Any]:
    rows = read_maintenance_events(symbol, store_root=store_root, limit=limit)
    return {
        "ok": True,
        "status": "store_v6_daily_maintenance_events",
        "events": rows,
        "count": len(rows),
    }


def should_run_daily_maintenance(symbol: str, *, store_root: Path | None = None, trigger: str = "startup") -> tuple[bool, str]:
    date = _today_key()
    record = _get_record(store_root, date, symbol)
    if record and record.get("status") == "completed":
        return False, "already_completed_today"
    if record and record.get("status") == "running" and not _is_running_expired(record):
        return False, "already_running"
    if record and record.get("status") == "running" and _is_running_expired(record):
        _append_event(store_root, {
            "date": date,
            "symbol": symbol,
            "trigger": trigger,
            "step": "previous_running_expired",
            "status": "expired",
        })
        _update_ledger(store_root, date, symbol, {"status": "failed", "failureReason": "previous_running_expired"})
    if trigger == "startup" and _now_local().hour < MAINTENANCE_HOUR:
        return False, "before_maintenance_hour"
    return True, "needs_maintenance"


def run_daily_maintenance_chain(symbol: str, *, trigger: str, store_root: Path | None = None) -> dict[str, Any]:
    from .store_v6_operations_service import aggregate_store_v6, audit_store_v6, pull_store_v6

    date = _today_key()
    run_id = uuid.uuid4().hex
    should_run, reason = should_run_daily_maintenance(symbol, store_root=store_root, trigger=trigger)
    if not should_run:
        _append_event(store_root, {
            "date": date,
            "symbol": symbol,
            "trigger": trigger,
            "runId": run_id,
            "step": "skipped",
            "status": "skipped",
            "reason": reason,
        })
        return {"ok": True, "status": "store_v6_daily_maintenance_skipped", "symbol": symbol, "reason": reason}

    operation_started = wait_start_operation(symbol, "daily_maintenance")
    if not operation_started:
        return {"ok": False, "status": "store_v6_daily_maintenance_busy", "symbol": symbol}

    started_at = utc_now_iso()
    should_run_after_lock, reason_after_lock = should_run_daily_maintenance(symbol, store_root=store_root, trigger=trigger)
    if not should_run_after_lock:
        _append_event(store_root, {
            "date": date,
            "symbol": symbol,
            "trigger": trigger,
            "runId": run_id,
            "step": "skipped_after_lock",
            "status": "skipped",
            "reason": reason_after_lock,
        })
        finish_operation(symbol, "daily_maintenance")
        return {"ok": True, "status": "store_v6_daily_maintenance_skipped", "symbol": symbol, "reason": reason_after_lock}
    _update_ledger(store_root, date, symbol, {
        "date": date,
        "symbol": symbol,
        "status": "running",
        "trigger": trigger,
        "runId": run_id,
        "startedAt": started_at,
        "finishedAt": None,
    })
    _append_event(store_root, {"date": date, "symbol": symbol, "trigger": trigger, "runId": run_id, "step": "started", "status": "running"})

    try:
        _append_event(store_root, {"date": date, "symbol": symbol, "trigger": trigger, "runId": run_id, "step": "pull_started", "status": "running"})
        wait_start_operation(symbol, "pull")
        try:
            pull_result = pull_store_v6(symbol, mode="incremental", count=10_000_000, store_root=store_root)
        finally:
            finish_operation(symbol, "pull")
        if pull_result.get("ok") is not True:
            raise RuntimeError(str(pull_result.get("error") or pull_result.get("status") or "pull_failed"))
        _append_event(store_root, {
            "date": date,
            "symbol": symbol,
            "trigger": trigger,
            "runId": run_id,
            "step": "pull_completed",
            "status": "completed",
            "rowsWritten": pull_result.get("rowsWritten"),
            "noNewClosedM1": pull_result.get("noNewClosedM1"),
        })

        _append_event(store_root, {"date": date, "symbol": symbol, "trigger": trigger, "runId": run_id, "step": "aggregate_started", "status": "running"})
        wait_start_operation(symbol, "aggregate")
        try:
            aggregate_result = aggregate_store_v6(symbol, timeframes=AGGREGATE_TIMEFRAMES_DEFAULT, rebuild=False, store_root=store_root)
        finally:
            finish_operation(symbol, "aggregate")
        if aggregate_result.get("ok") is not True:
            raise RuntimeError(str(aggregate_result.get("error") or aggregate_result.get("status") or "aggregate_failed"))
        _append_event(store_root, {
            "date": date,
            "symbol": symbol,
            "trigger": trigger,
            "runId": run_id,
            "step": "aggregate_completed",
            "status": "completed",
            "resultsCount": len(aggregate_result.get("results") or []),
        })

        _append_event(store_root, {"date": date, "symbol": symbol, "trigger": trigger, "runId": run_id, "step": "audit_started", "status": "running"})
        audit_result = audit_store_v6(symbol, repair=True, store_root=store_root)
        if audit_result.get("ok") is not True:
            raise RuntimeError(str(audit_result.get("error") or audit_result.get("status") or "audit_failed"))
        _append_event(store_root, {
            "date": date,
            "symbol": symbol,
            "trigger": trigger,
            "runId": run_id,
            "step": "audit_completed",
            "status": "completed",
            "repairedDatasets": audit_result.get("repairedDatasets"),
        })

        page_plan_version = uuid.uuid4().hex
        _append_event(store_root, {
            "date": date,
            "symbol": symbol,
            "trigger": trigger,
            "runId": run_id,
            "step": "page_plan_rebuild_requested",
            "status": "completed",
            "pagePlanVersion": page_plan_version,
        })
        record = _update_ledger(store_root, date, symbol, {
            "status": "completed",
            "trigger": trigger,
            "runId": run_id,
            "startedAt": started_at,
            "finishedAt": utc_now_iso(),
            "pagePlanVersion": page_plan_version,
        })
        return {"ok": True, "status": "store_v6_daily_maintenance_completed", "symbol": symbol, "record": record}
    except Exception as exc:
        _append_event(store_root, {
            "date": date,
            "symbol": symbol,
            "trigger": trigger,
            "runId": run_id,
            "step": "failed",
            "status": "failed",
            "error": str(exc),
        })
        record = _update_ledger(store_root, date, symbol, {
            "status": "failed",
            "trigger": trigger,
            "runId": run_id,
            "startedAt": started_at,
            "finishedAt": utc_now_iso(),
            "error": str(exc),
        })
        return {"ok": False, "status": "store_v6_daily_maintenance_failed", "symbol": symbol, "error": str(exc), "record": record}
    finally:
        finish_operation(symbol, "daily_maintenance")


def start_daily_maintenance(symbol: str, *, trigger: str = "manual", store_root: Path | None = None) -> dict[str, Any]:
    should_run, reason = should_run_daily_maintenance(symbol, store_root=store_root, trigger=trigger)
    if not should_run:
        _append_event(store_root, {
            "date": _today_key(),
            "symbol": symbol,
            "trigger": trigger,
            "step": "skipped",
            "status": "skipped",
            "reason": reason,
        })
        return {"ok": True, "status": "store_v6_daily_maintenance_skipped", "symbol": symbol, "reason": reason}
    thread = threading.Thread(target=run_daily_maintenance_chain, args=(symbol,), kwargs={"trigger": trigger, "store_root": store_root}, daemon=True)
    thread.start()
    return {"ok": True, "status": "store_v6_daily_maintenance_queued", "symbol": symbol, "trigger": trigger}


def _run_due_symbols(trigger: str, store_root: Path | None) -> None:
    for symbol in list_maintenance_symbols(store_root):
        should_run, reason = should_run_daily_maintenance(symbol, store_root=store_root, trigger=trigger)
        if should_run:
            start_daily_maintenance(symbol, trigger=trigger, store_root=store_root)
        elif trigger in {"startup", "scheduled_0600"}:
            _append_event(store_root, {
                "date": _today_key(),
                "symbol": symbol,
                "trigger": trigger,
                "step": "scheduler_check_skipped",
                "status": "skipped",
                "reason": reason,
            })


def _seconds_until_next_maintenance() -> float:
    now = _now_local()
    target = now.replace(hour=MAINTENANCE_HOUR, minute=0, second=0)
    if now >= target:
        target += timedelta(days=1)
    return max(1.0, (target - now).total_seconds())


def start_daily_maintenance_scheduler(*, store_root: Path | None = None) -> dict[str, Any]:
    global _SCHEDULER_STARTED
    with _LOCK:
        if _SCHEDULER_STARTED:
            return {"ok": True, "status": "store_v6_daily_maintenance_scheduler_already_started"}
        _SCHEDULER_STARTED = True

    def runner() -> None:
        _append_event(store_root, {
            "date": _today_key(),
            "symbol": "*",
            "trigger": "scheduler",
            "step": "scheduler_started",
            "status": "running",
            "maintenanceHour": MAINTENANCE_HOUR,
            "timezone": str(MAINTENANCE_TIMEZONE),
        })
        _run_due_symbols("startup", store_root)
        while True:
            time.sleep(_seconds_until_next_maintenance())
            _run_due_symbols("scheduled_0600", store_root)

    threading.Thread(target=runner, daemon=True, name="store-v6-daily-maintenance").start()
    return {"ok": True, "status": "store_v6_daily_maintenance_scheduler_started"}
