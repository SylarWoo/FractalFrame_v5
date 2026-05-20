from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from python.data_warehouse.aggregate.aggregate_from_m1_service_v1 import aggregate_from_m1_store_v5
from python.data_warehouse.mt5.mt5_m1_clean_service_v1 import clean_raw_m1_to_direct_store_v5
from python.data_warehouse.mt5.mt5_m1_pull_service_v1 import pull_mt5_m1_to_store_v5
from python.data_warehouse.mt5.mt5_m1_integrity_validator_v1 import (
    validate_incremental_true_m1_rows_v1,
    validate_true_m1_rows_v1,
)
from python.data_warehouse.query.duckdb_ohlcv_query_v5 import query_ohlcv_store_v5
from python.data_warehouse.store_v5.manifest_v5 import load_manifest_v5
from python.data_warehouse.store_v5.partitioned_parquet_writer_v5 import append_ohlcv_part_v5
from python.data_warehouse.store_v5.store_v5_paths import dataset_key


ANCHOR = 1735768800  # 2025-01-01 22:00:00 UTC


def make_rows(start: int, count: int, *, gap_after: int | None = None) -> list[dict]:
    rows = []
    shift = 0
    for i in range(count):
        if gap_after is not None and i > gap_after:
            shift = 180
        time_value = start + i * 60 + shift
        rows.append(
            {
                "time": time_value,
                "open": float(i),
                "high": float(i + 2),
                "low": float(i - 1),
                "close": float(i + 1),
                "volume": i + 10,
            }
        )
    return rows


class IntegrityValidatorTests(unittest.TestCase):
    def test_anchor_first_hour_and_gap_cases(self) -> None:
        ok = validate_true_m1_rows_v1(make_rows(ANCHOR, 120))
        self.assertTrue(ok["ok"])
        self.assertEqual(ok["trueM1RowsCount"], 120)
        self.assertEqual(ok["firstHourTrueRows"], 60)
        self.assertEqual(ok["gapCount"], 0)

        prefixed = validate_true_m1_rows_v1(make_rows(ANCHOR - 300, 125))
        self.assertTrue(prefixed["ok"])
        self.assertEqual(prefixed["discardedBeforeTrueM1RowsCount"], 0)
        self.assertEqual(prefixed["firstTrueM1Time"], ANCHOR - 300)

        non_anchor_start = validate_true_m1_rows_v1(make_rows(ANCHOR + 60, 60))
        self.assertTrue(non_anchor_start["ok"])
        self.assertEqual(non_anchor_start["firstTrueM1Time"], ANCHOR + 60)

        missing_first_hour = make_rows(ANCHOR, 59)
        bad_hour = validate_true_m1_rows_v1(missing_first_hour)
        self.assertFalse(bad_hour["ok"])
        self.assertEqual(bad_hour["error"], "no_true_m1_run_found")

        gap = validate_true_m1_rows_v1(make_rows(ANCHOR, 90, gap_after=64))
        self.assertTrue(gap["ok"])
        self.assertEqual(gap["gapCount"], 1)
        self.assertEqual(gap["firstGap"]["deltaSeconds"], 240)
        self.assertEqual(gap["firstGap"]["missingBarsEstimate"], 3)
        self.assertEqual(gap["trueM1RowsCount"], 90)

    def test_incremental_cases(self) -> None:
        rows = make_rows(ANCHOR, 11)
        ok = validate_incremental_true_m1_rows_v1(rows, last_true_m1_time=ANCHOR + 5 * 60)
        self.assertTrue(ok["ok"])
        self.assertEqual(ok["firstNewTime"], ANCHOR + 6 * 60)

        gap_rows = make_rows(ANCHOR, 6) + make_rows(ANCHOR + 8 * 60, 2)
        bad = validate_incremental_true_m1_rows_v1(gap_rows, last_true_m1_time=ANCHOR + 5 * 60)
        self.assertFalse(bad["ok"])
        self.assertEqual(bad["error"], "incremental_gap_after_last_true_m1")


class StorePipelineTests(unittest.TestCase):
    def test_pull_writes_raw_then_clean_rebuilds_direct(self) -> None:
        class FakeMt5:
            TIMEFRAME_M1 = "M1"

            def initialize(self) -> bool:
                return True

            def symbol_select(self, symbol: str, enabled: bool) -> bool:
                return True

            def copy_rates_from_pos(self, symbol: str, timeframe: str, pos: int, count: int):
                return make_rows(ANCHOR, 120)[pos : pos + count]

            def shutdown(self) -> None:
                pass

        with tempfile.TemporaryDirectory() as tmp:
            store_root = Path(tmp)
            pull = pull_mt5_m1_to_store_v5(
                symbol="XAUUSDm",
                count=120,
                import_mode="refresh",
                store_root=store_root,
                mt5_module=FakeMt5(),
            )
            self.assertTrue(pull["ok"])
            self.assertEqual(pull["datasetMode"], "raw_direct")

            manifest = load_manifest_v5(store_root)
            raw_key = dataset_key(provider="mt5", symbol="XAUUSDm", mode="raw_direct", timeframe="M1")
            direct_key = dataset_key(provider="mt5", symbol="XAUUSDm", mode="direct", timeframe="M1")
            self.assertIn(raw_key, manifest["datasets"])
            self.assertNotIn(direct_key, manifest["datasets"])

            clean = clean_raw_m1_to_direct_store_v5(symbol="XAUUSDm", store_root=store_root)
            self.assertTrue(clean["ok"])
            self.assertEqual(clean["rowsWritten"], 120)

            manifest = load_manifest_v5(store_root)
            self.assertIn(direct_key, manifest["datasets"])
            self.assertEqual(manifest["datasets"][direct_key]["sourceDataset"], raw_key)

    def test_writer_aggregator_and_query(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store_root = Path(tmp)
            rows = make_rows(ANCHOR, 2880)
            extra = {
                "mt5RowsCount": 2885,
                "trueM1RowsCount": 2880,
                "discardedBeforeAnchorRowsCount": 5,
                "firstAnchorTime": ANCHOR,
                "firstAnchorText": "2025-01-01 22:00:00 UTC",
                "lastTrueM1Time": rows[-1]["time"],
                "firstHourM1CheckOk": True,
                "firstHourExpectedRows": 60,
                "firstHourTrueRows": 60,
                "gapCount": 0,
                "firstGap": None,
                "m1IntegrityStatus": "true_m1_continuous",
            }
            first = append_ohlcv_part_v5(
                rows,
                provider="mt5",
                symbol="XAUUSDm",
                mode="direct",
                timeframe="M1",
                store_root=store_root,
                manifest_extra=extra,
            )
            self.assertEqual(first["rowsWritten"], 2880)

            duplicate = append_ohlcv_part_v5(
                rows,
                provider="mt5",
                symbol="XAUUSDm",
                mode="direct",
                timeframe="M1",
                store_root=store_root,
                manifest_extra=extra,
            )
            self.assertEqual(duplicate["rowsWritten"], 0)

            manifest = load_manifest_v5(store_root)
            direct_key = dataset_key(provider="mt5", symbol="XAUUSDm", mode="direct", timeframe="M1")
            direct = manifest["datasets"][direct_key]
            self.assertEqual(direct["rowsCount"], direct["trueM1RowsCount"])
            self.assertEqual(direct["mt5RowsCount"], 2885)
            self.assertTrue((store_root / direct["rootPath"] / "year=2025" / "month=01").exists())

            aggregate = aggregate_from_m1_store_v5(
                symbol="XAUUSDm",
                target_timeframes=["H1", "H4", "D1"],
                store_root=store_root,
                rebuild=True,
            )
            self.assertTrue(aggregate["ok"])
            self.assertEqual(aggregate["results"]["H1"]["rowsCount"], 48)
            self.assertEqual(aggregate["results"]["H4"]["rowsCount"], 12)
            self.assertEqual(aggregate["results"]["D1"]["rowsCount"], 2)

            direct_query = query_ohlcv_store_v5(symbol="XAUUSDm", timeframe="M1", store_root=store_root, limit=10)
            self.assertTrue(direct_query["ok"])
            self.assertEqual(direct_query["rowsCount"], 10)
            self.assertEqual([row["time"] for row in direct_query["rows"]], sorted(row["time"] for row in direct_query["rows"]))

            h1_query = query_ohlcv_store_v5(
                symbol="XAUUSDm",
                timeframe="H1",
                mode="aggregated",
                base_timeframe="M1",
                anchor="UTC2200",
                store_root=store_root,
                time_from=ANCHOR + 3600,
                time_to=ANCHOR + 4 * 3600,
                limit=2,
            )
            self.assertTrue(h1_query["ok"])
            self.assertEqual(h1_query["rowsCount"], 2)
            self.assertEqual(h1_query["metadata"]["datasetKey"], "mt5:XAUUSDm:aggregated:H1:base=M1:anchor=UTC2200")

            missing = query_ohlcv_store_v5(symbol="XAUUSDm", timeframe="M5", mode="aggregated", store_root=store_root)
            self.assertFalse(missing["ok"])
            self.assertEqual(missing["error"], "dataset_not_found")

    def test_incremental_aggregate_replaces_only_tail_partition(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store_root = Path(tmp)
            rows = make_rows(ANCHOR, 45000)
            extra = {
                "mt5RowsCount": 45000,
                "trueM1RowsCount": 45000,
                "firstAnchorTime": ANCHOR,
                "lastTrueM1Time": rows[-1]["time"],
                "firstHourM1CheckOk": True,
                "firstHourExpectedRows": 60,
                "firstHourTrueRows": 60,
                "gapCount": 0,
                "m1IntegrityStatus": "true_m1_continuous",
            }
            append_ohlcv_part_v5(
                rows,
                provider="mt5",
                symbol="XAUUSDm",
                mode="direct",
                timeframe="M1",
                store_root=store_root,
                manifest_extra=extra,
            )

            first = aggregate_from_m1_store_v5(
                symbol="XAUUSDm",
                target_timeframes=["M5"],
                store_root=store_root,
                rebuild=True,
            )
            self.assertTrue(first["ok"])
            self.assertEqual(first["results"]["M5"]["rowsCount"], 9000)

            new_rows = make_rows(ANCHOR + 45000 * 60, 5)
            append_ohlcv_part_v5(
                new_rows,
                provider="mt5",
                symbol="XAUUSDm",
                mode="direct",
                timeframe="M1",
                store_root=store_root,
                manifest_extra={**extra, "mt5RowsCount": 45005, "trueM1RowsCount": 45005, "lastTrueM1Time": new_rows[-1]["time"]},
            )

            second = aggregate_from_m1_store_v5(
                symbol="XAUUSDm",
                target_timeframes=["M5"],
                store_root=store_root,
                rebuild=False,
            )
            result = second["results"]["M5"]
            self.assertTrue(second["ok"])
            self.assertTrue(result["incremental"])
            self.assertEqual(result["lastAggregateM1RowsCount"], 10)
            self.assertEqual(result["tailAggregatedRowsCount"], 2)
            self.assertEqual(result["rowsCount"], 9001)
            self.assertLess(result["affectedOldRowsCount"], first["results"]["M5"]["rowsCount"])
            self.assertEqual(result["writeMode"], "tail_partition_replace")

    def test_calendar_aggregates_keep_session_gap_buckets(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store_root = Path(tmp)
            rows = make_rows(ANCHOR, 60)
            for index, time_value in enumerate([
                ANCHOR + 1 * 86400,
                ANCHOR + 2 * 86400,
                ANCHOR + 8 * 86400,
                ANCHOR + 35 * 86400,
            ], start=1000):
                rows.append(
                    {
                        "time": time_value,
                        "open": float(index),
                        "high": float(index + 2),
                        "low": float(index - 1),
                        "close": float(index + 1),
                        "volume": index + 10,
                    }
                )
            rows = sorted(rows, key=lambda row: row["time"])
            append_ohlcv_part_v5(
                rows,
                provider="mt5",
                symbol="XAUUSDm",
                mode="direct",
                timeframe="M1",
                store_root=store_root,
                manifest_extra={
                    "mt5RowsCount": len(rows),
                    "trueM1RowsCount": len(rows),
                    "firstAnchorTime": rows[0]["time"],
                    "lastTrueM1Time": rows[-1]["time"],
                    "firstHourM1CheckOk": True,
                    "firstHourExpectedRows": 60,
                    "firstHourTrueRows": 60,
                    "gapCount": 3,
                    "m1IntegrityStatus": "true_m1_with_session_gaps",
                },
            )

            aggregate = aggregate_from_m1_store_v5(
                symbol="XAUUSDm",
                target_timeframes=["D1", "W1", "MN1"],
                store_root=store_root,
                rebuild=True,
            )
            self.assertTrue(aggregate["ok"])
            self.assertGreater(aggregate["results"]["D1"]["rowsCount"], 1)
            self.assertGreater(aggregate["results"]["W1"]["rowsCount"], 1)
            self.assertGreater(aggregate["results"]["MN1"]["rowsCount"], 1)

    def test_fixed_aggregates_keep_middle_partial_session_buckets(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store_root = Path(tmp)
            rows = (
                make_rows(ANCHOR, 240)
                + make_rows(ANCHOR + 240 * 60, 238)
                + make_rows(ANCHOR + 480 * 60, 240)
            )
            append_ohlcv_part_v5(
                rows,
                provider="mt5",
                symbol="XAUUSDm",
                mode="direct",
                timeframe="M1",
                store_root=store_root,
                manifest_extra={
                    "mt5RowsCount": len(rows),
                    "trueM1RowsCount": len(rows),
                    "firstAnchorTime": rows[0]["time"],
                    "lastTrueM1Time": rows[-1]["time"],
                    "firstHourM1CheckOk": True,
                    "firstHourExpectedRows": 60,
                    "firstHourTrueRows": 60,
                    "gapCount": 1,
                    "m1IntegrityStatus": "true_m1_with_session_gaps",
                },
            )

            aggregate = aggregate_from_m1_store_v5(
                symbol="XAUUSDm",
                target_timeframes=["H4"],
                store_root=store_root,
                rebuild=True,
            )

            self.assertTrue(aggregate["ok"])
            self.assertEqual(aggregate["results"]["H4"]["rowsCount"], 3)


if __name__ == "__main__":
    unittest.main()
