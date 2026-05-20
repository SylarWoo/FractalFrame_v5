from __future__ import annotations

import threading
from typing import Any


M1_CHECK_JOBS: dict[str, dict[str, Any]] = {}
M1_CHECK_JOBS_LOCK = threading.Lock()

PULL_JOBS: dict[str, dict[str, Any]] = {}
PULL_JOBS_LOCK = threading.Lock()
PULL_JOBS_CONDITION = threading.Condition(PULL_JOBS_LOCK)
PULL_JOB_TERMINAL_PHASES = {"completed", "failed", "cancelled"}

AGGREGATE_JOBS: dict[str, dict[str, Any]] = {}
AGGREGATE_JOBS_LOCK = threading.Lock()
AGGREGATE_JOBS_CONDITION = threading.Condition(AGGREGATE_JOBS_LOCK)
AGGREGATE_JOB_TERMINAL_PHASES = {"completed", "failed", "cancelled"}
