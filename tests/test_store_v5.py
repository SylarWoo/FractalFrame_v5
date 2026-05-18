from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from python.data_warehouse.aggregate.aggregate_from_m1_service_v1 import aggregate_from_m1_store_v5
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
        self.assertEqual(prefixed["discardedBeforeAnchorRowsCount"], 5)
        self.assertEqual(prefixed["firstAnchorTime"], ANCHOR)

        no_anchor = validate_true_m1_rows_v1(make_rows(ANCHOR + 60, 60))
        self.assertFalse(no_anchor["ok"])
        self.assertEqual(no_anchor["error"], "no_utc_2200_anchor_found")

        missing_first_hour = make_rows(ANCHOR, 60)
        del missing_first_hour[10]
        bad_hour = validate_true_m1_rows_v1(missing_first_hour)
        self.assertFalse(bad_hour["ok"])
        self.assertEqual(bad_hour["error"], "first_hour_m1_not_continuous")

        gap = validate_true_m1_rows_v1(make_rows(ANCHOR, 90, gap_after=64))
        self.assertTrue(gap["ok"])
        self.assertEqual(gap["gapCount"], 1)
        self.assertEqual(gap["firstGap"]["deltaSeconds"], 240)
        self.assertEqual(gap["firstGap"]["missingBarsEstimate"], 3)

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


if __name__ == "__main__":
    unittest.main()
