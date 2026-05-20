from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from python.data_warehouse.aggregate.aggregate_from_m1_service_v1 import aggregate_from_m1_store_v5
from python.data_warehouse.store_v5.partitioned_parquet_writer_v5 import append_ohlcv_part_v5

from .store_v5_test_utils import ANCHOR, make_rows


class StoreAggregateTests(unittest.TestCase):
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
