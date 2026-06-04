from __future__ import annotations

import threading
import uuid
from pathlib import Path
from typing import Any

from .jobs import AGGREGATE_JOB_TERMINAL_PHASES
from .operation_locks import finish_operation, wait_start_operation
from .store_v5_status_service import utc_now_iso
from .store_v6_aggregate_job_state import (
    STORE_V6_AGGREGATE_JOBS,
    STORE_V6_AGGREGATE_JOBS_LOCK,
    STORE_V6_AGGREGATE_JOB_STORE,
    get_store_v6_aggregate_job,
    public_store_v6_aggregate_job_snapshot,
    set_store_v6_aggregate_job,
)


def _set_aggregate_job_v6(job_id: str, **updates: Any) -> dict[str, Any]:
    return set_store_v6_aggregate_job(job_id, **updates)


def _get_aggregate_job_v6(job_id: str) -> dict[str, Any] | None:
    return get_store_v6_aggregate_job(job_id)


def cancel_store_v6_aggregate_jobs_for_symbol(symbol: str) -> dict[str, Any]:
    cancelled: list[dict[str, Any]] = []
    with STORE_V6_AGGREGATE_JOBS_LOCK:
        job_ids = [
            job_id
            for job_id, job in STORE_V6_AGGREGATE_JOBS.items()
            if job.get("symbol") == symbol and str(job.get("phase") or "") not in AGGREGATE_JOB_TERMINAL_PHASES
        ]
    for job_id in job_ids:
        job = _set_aggregate_job_v6(job_id, cancelRequested=True, status="store_v6_aggregate_cancel_requested")
        if job:
            cancelled.append(job)
    return {
        "ok": True,
        "status": "store_v6_aggregate_cancel_requested",
        "symbol": symbol,
        "cancelledCount": len(cancelled),
        "jobs": cancelled,
    }


def run_store_v6_aggregate_job(job_id: str, symbol: str, *, timeframes: list[str], rebuild: bool, store_root: Path | None = None, batch_source_rows: int = 20_000) -> None:
    operation_started = False
    try:
        operation_started = wait_start_operation(symbol, "aggregate", is_cancelled=lambda: bool((_get_aggregate_job_v6(job_id) or {}).get("cancelRequested")))
        if not operation_started:
            _set_aggregate_job_v6(job_id, ok=False, phase="cancelled", status="store_v6_aggregate_cancelled", finishedAt=utc_now_iso())
            return
        _set_aggregate_job_v6(job_id, phase="running", status="store_v6_aggregate_running", currentPeriod=timeframes[0] if timeframes else None)
        from python.data_warehouse.store_v6.aggregate_v6 import aggregate_from_m1_store_v6

        def progress(**updates: Any) -> None:
            job = _get_aggregate_job_v6(job_id) or {}
            _set_aggregate_job_v6(
                job_id,
                phase=updates.get("phase", job.get("phase") or "running"),
                status=updates.get("status", "store_v6_aggregate_running"),
                currentPeriod=updates.get("currentPeriod", job.get("currentPeriod")),
                completed=updates.get("completed", job.get("completed") or 0),
                total=updates.get("total", job.get("total") or len(timeframes)),
                progressPercent=updates.get("progressPercent", job.get("progressPercent")),
                progressLabel=updates.get("progressLabel", job.get("progressLabel") or ""),
                aggregateBatchSize=updates.get("aggregateBatchSize", batch_source_rows),
                currentBatchIndex=updates.get("currentBatchIndex", job.get("currentBatchIndex") or 0),
                currentBatchTotal=updates.get("currentBatchTotal", job.get("currentBatchTotal") or 0),
                sourceRowsProcessed=updates.get("sourceRowsProcessed", job.get("sourceRowsProcessed") or 0),
                sourceRowsTotal=updates.get("sourceRowsTotal", job.get("sourceRowsTotal") or 0),
                rowsWritten=updates.get("rowsWritten", job.get("rowsWritten") or 0),
                sessionRuleId=updates.get("sessionRuleId", job.get("sessionRuleId")),
                sessionRuleVersion=updates.get("sessionRuleVersion", job.get("sessionRuleVersion")),
            )

        result = aggregate_from_m1_store_v6(
            symbol=symbol,
            target_timeframes=timeframes,
            rebuild=rebuild,
            store_root=store_root,
            batch_source_rows=batch_source_rows,
            progress=progress,
            is_cancelled=lambda: bool((_get_aggregate_job_v6(job_id) or {}).get("cancelRequested")),
        )
        if result.get("cancelled"):
            _set_aggregate_job_v6(job_id, ok=False, phase="cancelled", status="store_v6_aggregate_cancelled", progressLabel="Stopped", result=result, results=result.get("results"), finishedAt=utc_now_iso())
            return
        if result.get("ok") is not True:
            _set_aggregate_job_v6(job_id, ok=False, phase="failed", status=result.get("error") or "store_v6_aggregate_failed", error=result.get("error"), finishedAt=utc_now_iso())
            return
        _set_aggregate_job_v6(job_id, ok=True, phase="completed", status="store_v6_aggregate_completed", completed=len(timeframes), total=len(timeframes), progressPercent=100, progressLabel="Aggregation completed", currentPeriod=timeframes[-1] if timeframes else None, result=result, results=result.get("results"), finishedAt=utc_now_iso())
    except Exception as exc:
        _set_aggregate_job_v6(job_id, ok=False, phase="failed", status="store_v6_aggregate_exception", error=str(exc), finishedAt=utc_now_iso())
    finally:
        if operation_started:
            finish_operation(symbol, "aggregate")


def start_store_v6_aggregate_job(symbol: str, *, timeframes: list[str], rebuild: bool, store_root: Path | None = None) -> dict[str, Any]:
    job_id = uuid.uuid4().hex
    now = utc_now_iso()
    STORE_V6_AGGREGATE_JOB_STORE.prune_terminal(AGGREGATE_JOB_TERMINAL_PHASES)
    job = {
        "ok": True,
        "jobId": job_id,
        "symbol": symbol,
        "phase": "queued",
        "status": "store_v6_aggregate_queued",
        "periods": timeframes,
        "currentPeriod": timeframes[0] if timeframes else None,
        "completed": 0,
        "total": len(timeframes),
        "progressPercent": 0,
        "progressLabel": "Preparing aggregation: reading StoreV6 Clean M1",
        "aggregateBatchSize": 20_000,
        "currentBatchIndex": 0,
        "currentBatchTotal": 0,
        "sourceRowsProcessed": 0,
        "sourceRowsTotal": 0,
        "rowsWritten": 0,
        "sessionRuleId": None,
        "sessionRuleVersion": None,
        "createdAt": now,
        "updatedAt": now,
        "lastEventId": 1,
        "events": [],
    }
    snapshot = public_store_v6_aggregate_job_snapshot(job)
    job["events"].append({"id": 1, "event": "progress", "data": snapshot})
    STORE_V6_AGGREGATE_JOB_STORE.create(job_id, job)
    threading.Thread(target=run_store_v6_aggregate_job, args=(job_id, symbol), kwargs={"timeframes": timeframes, "rebuild": rebuild, "store_root": store_root}, daemon=True).start()
    return _get_aggregate_job_v6(job_id) or {"ok": False, "error": "job_not_found", "jobId": job_id}
