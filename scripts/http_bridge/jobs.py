from __future__ import annotations

import threading
import json
import os
from pathlib import Path
from typing import Any, Callable


M1_CHECK_JOBS: dict[str, dict[str, Any]] = {}
M1_CHECK_JOBS_LOCK = threading.Lock()
M1_CHECK_JOB_TERMINAL_PHASES = {"completed", "failed", "cancelled"}

PULL_JOBS: dict[str, dict[str, Any]] = {}
PULL_JOBS_LOCK = threading.Lock()
PULL_JOBS_CONDITION = threading.Condition(PULL_JOBS_LOCK)
PULL_JOB_TERMINAL_PHASES = {"completed", "failed", "cancelled"}

AGGREGATE_JOBS: dict[str, dict[str, Any]] = {}
AGGREGATE_JOBS_LOCK = threading.Lock()
AGGREGATE_JOBS_CONDITION = threading.Condition(AGGREGATE_JOBS_LOCK)
AGGREGATE_JOB_TERMINAL_PHASES = {"completed", "failed", "cancelled"}


SnapshotFn = Callable[[dict[str, Any]], dict[str, Any]]
ClockFn = Callable[[], str]


class InMemoryJobStore:
    def __init__(
        self,
        jobs: dict[str, dict[str, Any]],
        lock: threading.Lock,
        *,
        condition: threading.Condition | None = None,
        snapshot: SnapshotFn | None = None,
        clock: ClockFn | None = None,
        evented: bool = False,
        persist_name: str | None = None,
    ) -> None:
        self.jobs = jobs
        self.lock = lock
        self.condition = condition
        self.snapshot = snapshot or (lambda job: dict(job))
        self.clock = clock
        self.evented = evented
        self.persist_name = persist_name

    def create(self, job_id: str, job: dict[str, Any]) -> dict[str, Any]:
        with self._guard():
            self.jobs[job_id] = job
            self._persist_unlocked(job_id, self.snapshot(job))
            self._notify()
            return self.snapshot(job)

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self.lock:
            job = self.jobs.get(job_id)
            return self.snapshot(job) if job else None

    def update(self, job_id: str, **updates: Any) -> dict[str, Any]:
        with self._guard():
            job = self.jobs.get(job_id)
            if not job:
                return {}
            job.update(updates)
            if self.clock:
                job["updatedAt"] = self.clock()
            snapshot = self.snapshot(job)
            if self.evented:
                self._append_event(job, snapshot)
            self._persist_unlocked(job_id, snapshot)
            self._notify()
            return snapshot

    def prune_terminal(self, terminal_phases: set[str], *, max_jobs: int = 200) -> int:
        with self._guard():
            if len(self.jobs) <= max_jobs:
                return 0
            candidates = [
                (job_id, str(job.get("updatedAt") or job.get("createdAt") or ""))
                for job_id, job in self.jobs.items()
                if str(job.get("phase") or "") in terminal_phases
            ]
            candidates.sort(key=lambda item: item[1])
            remove_count = min(len(candidates), len(self.jobs) - max_jobs)
            for job_id, _ in candidates[:remove_count]:
                self.jobs.pop(job_id, None)
                self._delete_persisted_unlocked(job_id)
            if remove_count:
                self._notify()
            return remove_count

    def _append_event(self, job: dict[str, Any], snapshot: dict[str, Any]) -> None:
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
        snapshot["lastEventId"] = event_id
        events.append({"id": event_id, "event": event_name, "data": snapshot})
        if len(events) > 500:
            del events[:-500]

    def _guard(self) -> threading.Lock | threading.Condition:
        return self.condition or self.lock

    def _notify(self) -> None:
        if self.condition:
            self.condition.notify_all()

    def _snapshot_root(self) -> Path | None:
        if not self.persist_name:
            return None
        root = Path(os.environ.get("FRACTALFRAME_JOB_SNAPSHOT_ROOT", "runtime_data/jobs"))
        return root / self.persist_name

    def _persist_unlocked(self, job_id: str, snapshot: dict[str, Any]) -> None:
        root = self._snapshot_root()
        if root is None:
            return
        try:
            root.mkdir(parents=True, exist_ok=True)
            path = root / f"{job_id}.json"
            tmp = path.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            tmp.replace(path)
        except OSError:
            return

    def _delete_persisted_unlocked(self, job_id: str) -> None:
        root = self._snapshot_root()
        if root is None:
            return
        try:
            (root / f"{job_id}.json").unlink(missing_ok=True)
        except OSError:
            return
