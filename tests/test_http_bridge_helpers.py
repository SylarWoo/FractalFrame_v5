from __future__ import annotations

import threading
import unittest

from scripts.http_bridge.jobs import InMemoryJobStore
from scripts.http_bridge.store_v5_aggregate_job_service import _get_aggregate_job, start_store_v5_aggregate_job
from scripts.http_bridge.store_v5_pull_job_service import start_store_v5_pull_job
from scripts.http_bridge.store_v5_pull_job_state import get_pull_job
from scripts.http_bridge.route_helpers import first_query_value, parse_timeframes, required_job_id, required_symbol


class HttpBridgeRouteHelperTests(unittest.TestCase):
    def test_first_query_value_accepts_aliases(self) -> None:
        self.assertEqual(first_query_value({"job_id": ["abc"]}, "jobId", "job_id"), "abc")
        self.assertEqual(first_query_value({}, "missing", default="fallback"), "fallback")

    def test_required_values_trim_whitespace(self) -> None:
        self.assertEqual(required_symbol({"symbol": [" XAUUSDm "]}), "XAUUSDm")
        self.assertEqual(required_job_id({"jobId": [" job-1 "]}), "job-1")

    def test_parse_timeframes_normalizes_and_filters(self) -> None:
        self.assertEqual(parse_timeframes("m1, h4,, d1 "), ["M1", "H4", "D1"])
        self.assertEqual(parse_timeframes("", default="M5,H1"), ["M5", "H1"])


class InMemoryJobStoreTests(unittest.TestCase):
    def test_evented_update_appends_public_snapshot_event(self) -> None:
        jobs: dict[str, dict] = {}
        lock = threading.Lock()
        condition = threading.Condition(lock)
        store = InMemoryJobStore(
            jobs,
            lock,
            condition=condition,
            snapshot=lambda job: {key: value for key, value in job.items() if key != "events"},
            clock=lambda: "2026-05-21T00:00:00Z",
            evented=True,
        )
        store.create("job-1", {"jobId": "job-1", "phase": "queued", "lastEventId": 0, "events": []})

        snapshot = store.update("job-1", phase="completed", status="done")

        self.assertEqual(snapshot["phase"], "completed")
        self.assertEqual(snapshot["updatedAt"], "2026-05-21T00:00:00Z")
        self.assertEqual(snapshot["lastEventId"], 1)
        self.assertNotIn("events", snapshot)
        self.assertEqual(jobs["job-1"]["events"][0]["event"], "done")
        self.assertNotIn("events", jobs["job-1"]["events"][0]["data"])

    def test_prune_terminal_keeps_running_jobs(self) -> None:
        jobs = {
            "old": {"jobId": "old", "phase": "completed", "updatedAt": "2026-05-21T00:00:00Z"},
            "running": {"jobId": "running", "phase": "running", "updatedAt": "2026-05-21T00:00:01Z"},
            "new": {"jobId": "new", "phase": "failed", "updatedAt": "2026-05-21T00:00:02Z"},
        }
        lock = threading.Lock()
        store = InMemoryJobStore(jobs, lock)

        removed = store.prune_terminal({"completed", "failed", "cancelled"}, max_jobs=2)

        self.assertEqual(removed, 1)
        self.assertNotIn("old", jobs)
        self.assertIn("running", jobs)
        self.assertIn("new", jobs)


class HttpBridgeContractTests(unittest.TestCase):
    def test_pull_job_start_payload_has_frontend_contract_fields(self) -> None:
        payload = start_store_v5_pull_job("XAUUSDm", mode="refresh", count=1, store_root=None)
        job_id = payload["jobId"]
        try:
            job = get_pull_job(job_id)
            self.assertIsNotNone(job)
            assert job is not None
            for key in ["ok", "jobId", "symbol", "phase", "status", "progressPercent", "rowsFetched", "rowsWritten"]:
                self.assertIn(key, job)
            self.assertNotIn("events", job)
        finally:
            # The worker may fail quickly on machines without MT5; the contract check only needs the queued snapshot.
            pass

    def test_aggregate_job_start_payload_has_frontend_contract_fields(self) -> None:
        payload = start_store_v5_aggregate_job("XAUUSDm", timeframes=["M5", "H1"], rebuild=False, store_root=None)
        job = _get_aggregate_job(payload["jobId"])
        self.assertIsNotNone(job)
        assert job is not None
        for key in ["ok", "jobId", "symbol", "phase", "status", "periods", "currentPeriod", "completed", "total"]:
            self.assertIn(key, job)
        self.assertEqual(job["periods"], ["M5", "H1"])
        self.assertNotIn("events", job)


if __name__ == "__main__":
    unittest.main()
