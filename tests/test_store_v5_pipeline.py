from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from python.data_warehouse.aggregate.aggregate_from_m1_service_v1 import aggregate_from_m1_store_v5
from python.data_warehouse.mt5.mt5_m1_clean_service_v1 import clean_raw_m1_to_direct_store_v5
from python.data_warehouse.mt5.mt5_m1_pull_service_v1 import pull_mt5_m1_to_store_v5
from python.data_warehouse.query.duckdb_ohlcv_query_v5 import query_ohlcv_store_v5
from python.data_warehouse.store_v5.manifest_v5 import load_manifest_v5
from python.data_warehouse.store_v5.partitioned_parquet_writer_v5 import append_ohlcv_part_v5
from python.data_warehouse.store_v5.store_v5_paths import dataset_key

from .store_v5_test_utils import ANCHOR, make_rows


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

            clamped_query = query_ohlcv_store_v5(symbol="XAUUSDm", timeframe="M1", store_root=store_root, limit=0)
            self.assertTrue(clamped_query["ok"])
            self.assertEqual(clamped_query["rowsCount"], 1)
            self.assertEqual(clamped_query["warnings"], ["limit_clamped"])

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
