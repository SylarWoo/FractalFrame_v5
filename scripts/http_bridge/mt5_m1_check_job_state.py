from __future__ import annotations

from typing import Any

from .jobs import M1_CHECK_JOBS, M1_CHECK_JOBS_LOCK
from .store_v5_status_service import utc_now_iso


def _set_m1_check_job(job_id: str, **updates: Any) -> dict[str, Any]:
    with M1_CHECK_JOBS_LOCK:
        job = M1_CHECK_JOBS.get(job_id)
        if not job:
            return {}
        job.update(updates)
        job["updatedAt"] = utc_now_iso()
        return dict(job)


def _get_m1_check_job(job_id: str) -> dict[str, Any] | None:
    with M1_CHECK_JOBS_LOCK:
        job = M1_CHECK_JOBS.get(job_id)
        return dict(job) if job else None
