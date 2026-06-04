from __future__ import annotations

from typing import Any

from .jobs import InMemoryJobStore
from .store_v5_status_service import utc_now_iso
import threading


STORE_V6_AGGREGATE_JOBS: dict[str, dict[str, Any]] = {}
STORE_V6_AGGREGATE_JOBS_LOCK = threading.Lock()
STORE_V6_AGGREGATE_JOBS_CONDITION = threading.Condition(STORE_V6_AGGREGATE_JOBS_LOCK)


def public_store_v6_aggregate_job_snapshot(job: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in job.items() if key != "events"}


STORE_V6_AGGREGATE_JOB_STORE = InMemoryJobStore(
    STORE_V6_AGGREGATE_JOBS,
    STORE_V6_AGGREGATE_JOBS_LOCK,
    condition=STORE_V6_AGGREGATE_JOBS_CONDITION,
    snapshot=public_store_v6_aggregate_job_snapshot,
    clock=utc_now_iso,
    evented=True,
    persist_name="store_v6_aggregate",
)


def set_store_v6_aggregate_job(job_id: str, **updates: Any) -> dict[str, Any]:
    return STORE_V6_AGGREGATE_JOB_STORE.update(job_id, **updates)


def get_store_v6_aggregate_job(job_id: str) -> dict[str, Any] | None:
    return STORE_V6_AGGREGATE_JOB_STORE.get(job_id)
