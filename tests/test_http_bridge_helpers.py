from __future__ import annotations

import threading
import unittest

from scripts.http_bridge.jobs import InMemoryJobStore
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


if __name__ == "__main__":
    unittest.main()
