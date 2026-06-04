from __future__ import annotations

import threading
import uuid
from pathlib import Path
from typing import Any

from .jobs import PULL_JOB_TERMINAL_PHASES
from .operation_locks import finish_operation, wait_start_operation
from .store_v5_status_service import utc_now_iso
from .store_v6_pull_job_state import (
    STORE_V6_PULL_JOB_STORE,
    get_store_v6_pull_job,
    public_store_v6_pull_job_snapshot,
    set_store_v6_pull_job,
)


def run_store_v6_pull_job(
    job_id: str,
    symbol: str,
    *,
    mode: str,
    count: int | None,
    store_root: Path | None,
    batch_size: int = 20_000,
) -> None:
    operation_started = False
    try:
        set_store_v6_pull_job(
            job_id,
            phase="queued",
            status="store_v6_pull_waiting_for_symbol_slot",
            progressLabel="Preparing pull: waiting for symbol slot",
        )
        operation_started = wait_start_operation(
            symbol,
            "pull",
            is_cancelled=lambda: bool((get_store_v6_pull_job(job_id) or {}).get("cancelRequested")),
        )
        if not operation_started:
            set_store_v6_pull_job(job_id, ok=False, phase="cancelled", status="store_v6_pull_cancelled", finishedAt=utc_now_iso())
            return

        from python.data_warehouse.store_v6.pull_v6 import pull_mt5_m1_to_store_v6

        def progress(**updates: Any) -> None:
            job = get_store_v6_pull_job(job_id) or {}
            rows_fetched = int(updates.get("rowsFetched", job.get("rowsFetched") or 0) or 0)
            max_count = updates.get("maxCount", job.get("maxCount"))
            progress_percent = updates.get("progressPercent")
            if progress_percent is None and max_count:
                progress_percent = max(1, min(98, round((rows_fetched / max(1, int(max_count))) * 98, 2)))
            set_store_v6_pull_job(
                job_id,
                phase=updates.get("phase", job.get("phase") or "fetching"),
                status=updates.get("status", "store_v6_pull_running"),
                progressPercent=progress_percent,
                rowsFetched=rows_fetched,
                rowsWritten=int(updates.get("rowsWritten", job.get("rowsWritten") or 0) or 0),
                rawRowsCount=int(updates.get("rawRowsCount", job.get("rawRowsCount") or 0) or 0),
                duplicateRows=int(updates.get("duplicateRows", job.get("duplicateRows") or 0) or 0),
                rejectedRows=int(updates.get("rejectedRows", job.get("rejectedRows") or 0) or 0),
                currentBatchIndex=updates.get("currentBatchIndex", job.get("currentBatchIndex") or 0),
                fetchChunkSize=batch_size,
                maxCount=max_count,
                progressLabel=updates.get("progressLabel", job.get("progressLabel") or ""),
                detailMessage=updates.get("detailMessage", job.get("detailMessage") or ""),
                sessionRuleId=updates.get("sessionRuleId", job.get("sessionRuleId")),
                sessionRuleVersion=updates.get("sessionRuleVersion", job.get("sessionRuleVersion")),
            )

        report = pull_mt5_m1_to_store_v6(
            symbol=symbol,
            mode=mode,
            count=count,
            store_root=store_root,
            batch_size=batch_size,
            pull_job_id=job_id,
            progress=progress,
            is_cancelled=lambda: bool((get_store_v6_pull_job(job_id) or {}).get("cancelRequested")),
        )
        if report.get("cancelled"):
            set_store_v6_pull_job(
                job_id,
                ok=False,
                phase="cancelled",
                status="store_v6_pull_cancelled",
                progressLabel="Stopped",
                finishedAt=utc_now_iso(),
            )
            return
        if report.get("ok") is not True:
            set_store_v6_pull_job(
                job_id,
                ok=False,
                phase="failed",
                status=report.get("status") or "store_v6_pull_failed",
                error=report.get("error"),
                progressLabel=f"Failed: {report.get('error') or report.get('status')}",
                finishedAt=utc_now_iso(),
            )
            return
        set_store_v6_pull_job(
            job_id,
            ok=True,
            phase="completed",
            status="store_v6_pull_completed",
            progressPercent=100,
            rowsFetched=report.get("mt5RowsCount") or 0,
            rowsWritten=report.get("rowsWritten") or 0,
            rawRowsCount=report.get("rawRowsCount") or 0,
            duplicateRows=report.get("duplicateRows") or 0,
            rejectedRows=report.get("rejectedRows") or 0,
            progressLabel="没有新的已闭合 M1，已跳过拉取" if report.get("noNewClosedM1") else "Pull completed: StoreV6 advanced to latest available M1",
            detailMessage="StoreV6 Clean M1 is already at the latest closed minute" if report.get("noNewClosedM1") else "StoreV6 Raw/Clean M1 updated",
            result=report,
            finishedAt=utc_now_iso(),
        )
    except Exception as exc:
        set_store_v6_pull_job(
            job_id,
            ok=False,
            phase="failed",
            status="store_v6_pull_exception",
            error=str(exc),
            progressLabel=f"Failed: {exc}",
            finishedAt=utc_now_iso(),
        )
    finally:
        if operation_started:
            finish_operation(symbol, "pull")


def start_store_v6_pull_job(symbol: str, *, mode: str, count: int | None, store_root: Path | None = None) -> dict[str, Any]:
    job_id = uuid.uuid4().hex
    now = utc_now_iso()
    STORE_V6_PULL_JOB_STORE.prune_terminal(PULL_JOB_TERMINAL_PHASES)
    job = {
        "ok": True,
        "jobId": job_id,
        "symbol": symbol,
        "mode": mode,
        "phase": "queued",
        "status": "store_v6_pull_queued",
        "progressPercent": 0,
        "rowsFetched": 0,
        "rowsWritten": 0,
        "rawRowsCount": 0,
        "duplicateRows": 0,
        "rejectedRows": 0,
        "fetchChunkSize": 20_000,
        "maxCount": count,
        "currentBatchIndex": 0,
        "progressLabel": "Preparing pull: reading local Clean M1 tail",
        "detailMessage": "Waiting for StoreV6 pull job to start",
        "sessionRuleId": None,
        "sessionRuleVersion": None,
        "createdAt": now,
        "updatedAt": now,
        "lastEventId": 1,
        "events": [],
    }
    snapshot = public_store_v6_pull_job_snapshot(job)
    job["events"].append({"id": 1, "event": "progress", "data": snapshot})
    STORE_V6_PULL_JOB_STORE.create(job_id, job)
    threading.Thread(
        target=run_store_v6_pull_job,
        args=(job_id, symbol),
        kwargs={"mode": mode, "count": count, "store_root": store_root},
        daemon=True,
    ).start()
    return get_store_v6_pull_job(job_id) or {"ok": False, "error": "job_not_found", "jobId": job_id}
