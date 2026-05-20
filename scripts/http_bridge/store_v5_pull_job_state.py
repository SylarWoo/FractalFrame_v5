from __future__ import annotations

from typing import Any

from .jobs import PULL_JOBS, PULL_JOBS_CONDITION, PULL_JOBS_LOCK
from .store_v5_status_service import utc_now_iso


def public_pull_job_snapshot(job: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in job.items() if key != "events"}


def set_pull_job(job_id: str, **updates: Any) -> dict[str, Any]:
    with PULL_JOBS_CONDITION:
        job = PULL_JOBS.get(job_id)
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
        snapshot = public_pull_job_snapshot(job)
        events.append({"id": event_id, "event": event_name, "data": snapshot})
        if len(events) > 500:
            del events[:-500]
        PULL_JOBS_CONDITION.notify_all()
        return snapshot


def get_pull_job(job_id: str) -> dict[str, Any] | None:
    with PULL_JOBS_LOCK:
        job = PULL_JOBS.get(job_id)
        return public_pull_job_snapshot(job) if job else None


def read_progress(rows_fetched: int, chunks_completed: int, target: int | None) -> float:
    if target:
        return min(70, round((rows_fetched / target) * 70, 2))
    return min(65, 15 + chunks_completed * 3)


def write_progress(rows_written: int, chunks_completed: int, target: int | None) -> float:
    if target:
        return 70 + min(26, round((rows_written / target) * 26, 2))
    return min(90, 70 + chunks_completed * 2)
