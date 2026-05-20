from __future__ import annotations

from typing import Any

from .jobs import InMemoryJobStore, PULL_JOBS, PULL_JOBS_CONDITION, PULL_JOBS_LOCK
from .store_v5_status_service import utc_now_iso


def public_pull_job_snapshot(job: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in job.items() if key != "events"}


PULL_JOB_STORE = InMemoryJobStore(
    PULL_JOBS,
    PULL_JOBS_LOCK,
    condition=PULL_JOBS_CONDITION,
    snapshot=public_pull_job_snapshot,
    clock=utc_now_iso,
    evented=True,
    persist_name="pull",
)


def set_pull_job(job_id: str, **updates: Any) -> dict[str, Any]:
    return PULL_JOB_STORE.update(job_id, **updates)


def get_pull_job(job_id: str) -> dict[str, Any] | None:
    return PULL_JOB_STORE.get(job_id)


def read_progress(rows_fetched: int, chunks_completed: int, target: int | None) -> float:
    if target:
        return min(70, round((rows_fetched / target) * 70, 2))
    return min(65, 15 + chunks_completed * 3)


def write_progress(rows_written: int, chunks_completed: int, target: int | None) -> float:
    if target:
        return 70 + min(26, round((rows_written / target) * 26, 2))
    return min(90, 70 + chunks_completed * 2)
