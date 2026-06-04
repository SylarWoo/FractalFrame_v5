from __future__ import annotations

import threading
import tempfile
import unittest
import os
import json
from pathlib import Path

from scripts.http_bridge.jobs import InMemoryJobStore
from scripts.http_bridge.store_v5_aggregate_job_service import _get_aggregate_job, start_store_v5_aggregate_job
from scripts.http_bridge.store_v5_pull_context import StoreV5PullContext
from scripts.http_bridge.store_v5_pull_fetch_service import fetch_store_v5_raw_m1
from scripts.http_bridge.store_v5_pull_job_service import start_store_v5_pull_job
from scripts.http_bridge.store_v5_pull_job_state import PULL_JOB_STORE, get_pull_job
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

    def test_persisted_snapshot_is_written_without_events(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            old_root = os.environ.get("FRACTALFRAME_JOB_SNAPSHOT_ROOT")
            os.environ["FRACTALFRAME_JOB_SNAPSHOT_ROOT"] = tmp
            try:
                jobs: dict[str, dict] = {}
                lock = threading.Lock()
                store = InMemoryJobStore(
                    jobs,
                    lock,
                    snapshot=lambda job: {key: value for key, value in job.items() if key != "events"},
                    persist_name="test",
                )
                store.create("job-1", {"jobId": "job-1", "phase": "queued", "events": []})
                store.update("job-1", phase="completed")

                path = os.path.join(tmp, "test", "job-1.json")
                with open(path, encoding="utf-8") as f:
                    payload = json.load(f)
                self.assertEqual(payload["phase"], "completed")
                self.assertNotIn("events", payload)
            finally:
                if old_root is None:
                    os.environ.pop("FRACTALFRAME_JOB_SNAPSHOT_ROOT", None)
                else:
                    os.environ["FRACTALFRAME_JOB_SNAPSHOT_ROOT"] = old_root


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

    def test_api_schema_file_is_valid_json(self) -> None:
        payload = json.loads(Path("docs/api/schema.json").read_text(encoding="utf-8"))
        self.assertEqual(payload["title"], "FractalFrame Market Data API")
        self.assertIn("basePayload", payload["definitions"])


class StoreV6StylePullTests(unittest.TestCase):
    def test_initial_pull_processes_mt5_history_from_oldest_to_latest(self) -> None:
        class FakeMt5:
            TIMEFRAME_M1 = object()

            def __init__(self) -> None:
                self.rows_by_position = [
                    {"time": 300, "open": 5, "high": 5, "low": 5, "close": 5, "tick_volume": 1},
                    {"time": 240, "open": 4, "high": 4, "low": 4, "close": 4, "tick_volume": 1},
                    {"time": 180, "open": 3, "high": 3, "low": 3, "close": 3, "tick_volume": 1},
                    {"time": 120, "open": 2, "high": 2, "low": 2, "close": 2, "tick_volume": 1},
                    {"time": 60, "open": 1, "high": 1, "low": 1, "close": 1, "tick_volume": 1},
                ]

            def copy_rates_from_pos(self, symbol: str, timeframe: object, start_pos: int, count: int) -> list[dict]:
                return self.rows_by_position[start_pos:start_pos + count]

        ctx = StoreV5PullContext(
            root=Path("."),
            raw_key="raw",
            direct_key="direct",
            mode="refresh",
            step=2,
            target=5,
            pos=0,
        )
        ctx.write_buffer_target = 2
        written_times: list[int] = []

        def append_rows(rows: list[dict], **kwargs: object) -> dict[str, object]:
            written_times.extend(int(row["time"]) for row in rows)
            return {"rowsWritten": len(rows), "duplicateRows": 0}

        def to_canonical(row: dict, **kwargs: object) -> dict:
            return {
                "time": int(row["time"]),
                "open": row["open"],
                "high": row["high"],
                "low": row["low"],
                "close": row["close"],
                "volume": row["tick_volume"],
            }

        job_id = "store-v6-style-forward-test"
        PULL_JOB_STORE.create(job_id, {"jobId": job_id, "phase": "queued", "lastEventId": 0, "events": []})

        ok = fetch_store_v5_raw_m1(
            ctx,
            append_ohlcv_part_v5=append_rows,
            job_id=job_id,
            mt5=FakeMt5(),
            mt5_row_to_canonical=to_canonical,
            symbol="XAUUSDm",
        )

        self.assertTrue(ok)
        self.assertEqual(written_times + [int(row["time"]) for row in ctx.pending_rows], [60, 120, 180, 240, 300])


if __name__ == "__main__":
    unittest.main()
