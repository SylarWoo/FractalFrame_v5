from __future__ import annotations

from typing import Any

from .jobs import InMemoryJobStore, M1_CHECK_JOBS, M1_CHECK_JOBS_LOCK
from .store_v5_status_service import utc_now_iso


M1_CHECK_JOB_STORE = InMemoryJobStore(
    M1_CHECK_JOBS,
    M1_CHECK_JOBS_LOCK,
    clock=utc_now_iso,
    persist_name="m1_check",
)


def _set_m1_check_job(job_id: str, **updates: Any) -> dict[str, Any]:
    return M1_CHECK_JOB_STORE.update(job_id, **updates)


def _get_m1_check_job(job_id: str) -> dict[str, Any] | None:
    return M1_CHECK_JOB_STORE.get(job_id)
