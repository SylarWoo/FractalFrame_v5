from __future__ import annotations

import threading
import uuid
from pathlib import Path
from typing import Any

from .jobs import AGGREGATE_JOBS, AGGREGATE_JOBS_CONDITION, AGGREGATE_JOBS_LOCK
from .store_v5_operations_service import aggregate_store_v5
from .store_v5_status_service import utc_now_iso


def _public_aggregate_job_snapshot(job: dict[str, Any]) -> dict[str, Any]:
    snapshot = {key: value for key, value in job.items() if key != "events"}
    targets = list(snapshot.get("targets") or [])
    current_index = int(snapshot.get("currentIndex") or 0)
    phase = str(snapshot.get("phase") or "")
    snapshot.setdefault("periods", targets)
    snapshot.setdefault("currentPeriod", snapshot.get("currentTarget"))
    snapshot.setdefault("total", int(snapshot.get("totalTargets") or len(targets)))
    snapshot.setdefault("completed", int(snapshot.get("total") or len(targets)) if phase == "completed" else max(0, current_index - 1))
    return snapshot


def _set_aggregate_job(job_id: str, **updates: Any) -> dict[str, Any]:
    with AGGREGATE_JOBS_CONDITION:
        job = AGGREGATE_JOBS.get(job_id)
        if not job:
            return {}
        job.update(updates)
        job["updatedAt"] = utc_now_iso()
        events = job.setdefault("events", [])
        event_id = int(job.get("lastEventId") or 0) + 1
        job["lastEventId"] = event_id
        phase = str(job.get("phase") or "")
        event_name = "progress"
        if phase == "completed":
            event_name = "done"
        elif phase == "failed":
            event_name = "error"
        elif phase == "cancelled":
            event_name = "cancelled"
        snapshot = _public_aggregate_job_snapshot(job)
        events.append({"id": event_id, "event": event_name, "data": snapshot})
        if len(events) > 500:
            del events[:-500]
        AGGREGATE_JOBS_CONDITION.notify_all()
        return snapshot


def _get_aggregate_job(job_id: str) -> dict[str, Any] | None:
    with AGGREGATE_JOBS_LOCK:
        job = AGGREGATE_JOBS.get(job_id)
        return _public_aggregate_job_snapshot(job) if job else None


def run_store_v5_aggregate_job(job_id: str, symbol: str, *, timeframes: list[str], rebuild: bool, store_root: Path | None = None) -> None:
    results: dict[str, Any] = {}
    try:
        _set_aggregate_job(
            job_id,
            phase="running",
            status="store_v5_aggregate_running",
            progressPercent=1,
            progressLabel=f"Start aggregation: {len(timeframes)} periods",
            currentIndex=0,
            totalTargets=len(timeframes),
            results=results,
        )
        job = _get_aggregate_job(job_id)
        if job and job.get("cancelRequested"):
            _set_aggregate_job(
                job_id,
                ok=False,
                phase="cancelled",
                status="store_v5_aggregate_cancelled",
                progressLabel="Cancelled",
                finishedAt=utc_now_iso(),
            )
            return
        _set_aggregate_job(
            job_id,
            phase="running",
            status="store_v5_aggregate_targets_running",
            currentTarget=",".join(timeframes),
            currentIndex=1,
            totalTargets=len(timeframes),
            progressPercent=5,
            progressLabel=f"Aggregating: {','.join(timeframes)}",
            results=results,
        )
        payload = aggregate_store_v5(symbol, timeframes=timeframes, rebuild=rebuild, store_root=store_root)
        if payload.get("ok") is not True:
            raise RuntimeError(str(payload.get("error") or payload.get("status") or "store_v5_aggregate_failed"))
        results.update(payload.get("results") or {})
        for timeframe in timeframes:
            target_result = results.get(timeframe) or {}
            if target_result.get("ok") is not True:
                raise RuntimeError(str(target_result.get("error") or target_result.get("status") or f"{timeframe} aggregate failed"))
        report = {
            "ok": True,
            "status": "store_v5_aggregate_completed",
            "symbol": symbol,
            "storeVersion": "v5",
            "results": results,
        }
        _set_aggregate_job(
            job_id,
            ok=True,
            phase="completed",
            status="store_v5_aggregate_completed",
            progressPercent=100,
            progressLabel=f"Aggregation completed: {len(timeframes)} periods",
            results=results,
            result=report,
            finishedAt=utc_now_iso(),
        )
    except Exception as exc:
        _set_aggregate_job(
            job_id,
            ok=False,
            phase="failed",
            status="store_v5_aggregate_failed",
            error=str(exc),
            progressPercent=None,
            progressLabel=f"Aggregation failed: {exc}",
            results=results,
            finishedAt=utc_now_iso(),
        )


def start_store_v5_aggregate_job(symbol: str, *, timeframes: list[str], rebuild: bool, store_root: Path | None = None) -> dict[str, Any]:
    job_id = uuid.uuid4().hex
    now = utc_now_iso()
    targets = [item.strip().upper() for item in timeframes if item.strip()]
    with AGGREGATE_JOBS_CONDITION:
        job = {
            "ok": True,
            "jobId": job_id,
            "symbol": symbol,
            "phase": "queued",
            "status": "store_v5_aggregate_queued",
            "progressPercent": 0,
            "progressLabel": "Preparing aggregation",
            "targets": targets,
            "currentTarget": None,
            "currentIndex": 0,
            "totalTargets": len(targets),
            "results": {},
            "rebuild": bool(rebuild),
            "createdAt": now,
            "updatedAt": now,
            "lastEventId": 1,
            "events": [],
        }
        snapshot = _public_aggregate_job_snapshot(job)
        job["events"].append({"id": 1, "event": "progress", "data": snapshot})
        AGGREGATE_JOBS[job_id] = job
        AGGREGATE_JOBS_CONDITION.notify_all()
    threading.Thread(
        target=run_store_v5_aggregate_job,
        args=(job_id, symbol),
        kwargs={"timeframes": targets, "rebuild": rebuild, "store_root": store_root},
        daemon=True,
    ).start()
    return _get_aggregate_job(job_id) or {"ok": False, "error": "job_not_found", "jobId": job_id}
