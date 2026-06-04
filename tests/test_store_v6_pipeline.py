from __future__ import annotations

import tempfile
import unittest
from datetime import timezone
from pathlib import Path

from python.data_warehouse.store_v6.aggregate_v6 import aggregate_from_m1_store_v6
from python.data_warehouse.store_v6.audit_v6 import audit_store_v6
from python.data_warehouse.store_v6.manifest_v6 import get_dataset_cell, load_manifest_v6, save_manifest_v6
from python.data_warehouse.store_v6.pull_v6 import pull_mt5_m1_to_store_v6
from python.data_warehouse.store_v6.query_v6 import query_ohlcv_store_v6
from python.data_warehouse.store_v6.status_v6 import check_store_v6
from python.data_warehouse.store_v6.paths_v6 import dataset_key
from python.data_warehouse.store_v6.symbol_sessions_v6 import read_symbol_session_rule_v6, sync_symbol_sessions_v6, trading_rules_path

from .store_v5_test_utils import ANCHOR, make_rows


class StoreV6PipelineTests(unittest.TestCase):
    def test_pull_query_and_aggregate_use_independent_store_v6(self) -> None:
        class FakeMt5:
            TIMEFRAME_M1 = "M1"

            def __init__(self) -> None:
                self.rows = list(reversed(make_rows(ANCHOR, 120)))

            def copy_rates_from_pos(self, symbol: str, timeframe: str, pos: int, count: int):
                return self.rows[pos:pos + count]

        with tempfile.TemporaryDirectory() as tmp:
            store_root = Path(tmp)
            sync_symbol_sessions_v6(
                [
                    {
                        "symbol": "XAUUSDm",
                        "name": "Gold",
                        "market": "forex_metal",
                        "sessions": {
                            "quote": ["", "", "", "22:00-23:59", "", "", ""],
                            "trade": ["", "", "", "22:00-23:59", "", "", ""],
                        },
                        "sessionsSource": "mql5_export",
                    }
                ],
                store_root=store_root,
                generated_at="2026-06-02T10:00:00Z",
            )
            pull = pull_mt5_m1_to_store_v6(
                symbol="XAUUSDm",
                mode="refresh",
                count=120,
                store_root=store_root,
                mt5_module=FakeMt5(),
                batch_size=20,
            )
            self.assertTrue(pull["ok"])
            self.assertEqual(pull["storeVersion"], "store_v6")
            self.assertEqual(pull["rowsWritten"], 120)

            status = check_store_v6("XAUUSDm", store_root=store_root)
            self.assertTrue(status["ok"])
            self.assertEqual(status["storeVersion"], "store_v6")
            self.assertEqual(status["directM1"]["rowsCount"], 120)

            query = query_ohlcv_store_v6(symbol="XAUUSDm", timeframe="M1", store_root=store_root, limit=5)
            self.assertTrue(query["ok"])
            self.assertEqual(query["provider"], "store_v6_duckdb")
            self.assertEqual(query["rowsCount"], 5)
            self.assertTrue(query["rows"][0]["barKey"].startswith("XAUUSDm|M1|"))
            self.assertEqual(query["rows"][0]["sessionRuleId"], "XAUUSDm:session-rule:v1")
            self.assertEqual(query["rows"][0]["sessionState"], "trading")
            self.assertIs(query["rows"][0]["isTradingTime"], True)

            tail_query = query_ohlcv_store_v6(
                symbol="XAUUSDm",
                timeframe="M1",
                store_root=store_root,
                limit=3,
                time_to=ANCHOR + 59 * 60,
            )
            self.assertTrue(tail_query["ok"])
            self.assertEqual([row["time"] for row in tail_query["rows"]], [
                ANCHOR + 57 * 60,
                ANCHOR + 58 * 60,
                ANCHOR + 59 * 60,
            ])

            aggregate_events: list[dict] = []
            aggregate = aggregate_from_m1_store_v6(
                symbol="XAUUSDm",
                target_timeframes=["M5", "H1"],
                store_root=store_root,
                rebuild=True,
                batch_source_rows=60,
                progress=lambda **updates: aggregate_events.append(updates),
            )
            self.assertTrue(aggregate["ok"])
            self.assertEqual(aggregate["results"]["H1"]["rowsWritten"], 2)
            self.assertGreaterEqual(len([event for event in aggregate_events if event.get("currentPeriod") == "M5" and event.get("currentBatchIndex")]), 2)
            self.assertTrue(any(event.get("progressPercent") for event in aggregate_events))
            repeat = aggregate_from_m1_store_v6(symbol="XAUUSDm", target_timeframes=["M5", "H1"], store_root=store_root, rebuild=False)
            self.assertTrue(repeat["ok"])
            self.assertTrue(repeat["results"]["M5"]["skipped"])
            self.assertTrue(repeat["results"]["H1"]["skipped"])

            noop = pull_mt5_m1_to_store_v6(
                symbol="XAUUSDm",
                mode="incremental",
                store_root=store_root,
                mt5_module=FakeMt5(),
                batch_size=20,
                current_time=ANCHOR + 120 * 60,
            )
            self.assertTrue(noop["ok"])
            self.assertTrue(noop["noNewClosedM1"])
            self.assertEqual(noop["rowsWritten"], 0)
            h1_key = dataset_key(provider="mt5", symbol="XAUUSDm", mode="aggregated", timeframe="H1", base_timeframe="M1", anchor="UTC2200")
            self.assertFalse(get_dataset_cell(store_root, h1_key).get("dirty"))

            h1 = query_ohlcv_store_v6(symbol="XAUUSDm", timeframe="H1", mode="aggregated", store_root=store_root, limit=10)
            self.assertTrue(h1["ok"])
            self.assertEqual(h1["rowsCount"], 2)
            self.assertTrue(h1["rows"][0]["barKey"].startswith("XAUUSDm|H1|"))
            self.assertEqual(h1["rows"][0]["sessionRuleId"], "XAUUSDm:session-rule:v1")

            clean_key = dataset_key(provider="mt5", symbol="XAUUSDm", mode="clean", timeframe="M1")
            self.assertEqual(status["directM1"]["datasetKey"], clean_key)

    def test_aggregate_updates_only_tail_when_clean_m1_advances(self) -> None:
        class FakeMt5:
            TIMEFRAME_M1 = "M1"

            def __init__(self, rows: list[dict]) -> None:
                self.rows = list(reversed(rows))

            def copy_rates_from_pos(self, symbol: str, timeframe: str, pos: int, count: int):
                return self.rows[pos:pos + count]

            def copy_rates_range(self, symbol: str, timeframe: str, date_from, date_to):
                from_ts = int(date_from.astimezone(timezone.utc).timestamp())
                to_ts = int(date_to.astimezone(timezone.utc).timestamp())
                chronological = list(reversed(self.rows))
                return [row for row in chronological if from_ts <= int(row["time"]) <= to_ts]

        with tempfile.TemporaryDirectory() as tmp:
            store_root = Path(tmp)
            pull_mt5_m1_to_store_v6(
                symbol="XAUUSDm",
                mode="refresh",
                count=120,
                store_root=store_root,
                mt5_module=FakeMt5(make_rows(ANCHOR, 120)),
                batch_size=120,
            )
            aggregate_from_m1_store_v6(symbol="XAUUSDm", target_timeframes=["M5"], store_root=store_root, rebuild=True)

            pull_mt5_m1_to_store_v6(
                symbol="XAUUSDm",
                mode="incremental",
                store_root=store_root,
                mt5_module=FakeMt5(make_rows(ANCHOR, 130)),
                batch_size=20,
                current_time=ANCHOR + 130 * 60,
            )
            events: list[dict] = []
            result = aggregate_from_m1_store_v6(
                symbol="XAUUSDm",
                target_timeframes=["M5"],
                store_root=store_root,
                rebuild=False,
                batch_source_rows=20,
                progress=lambda **updates: events.append(updates),
            )

            self.assertTrue(result["ok"])
            self.assertEqual(result["results"]["M5"]["rowsCount"], 26)
            tail_events = [event for event in events if event.get("sourceRowsTotal")]
            self.assertTrue(tail_events)
            self.assertLess(max(int(event["sourceRowsTotal"]) for event in tail_events), 130)

    def test_aggregate_repairs_manifest_when_source_time_is_ahead_of_last_bar(self) -> None:
        class FakeMt5:
            TIMEFRAME_M1 = "M1"

            def __init__(self, rows: list[dict]) -> None:
                self.rows = list(reversed(rows))

            def copy_rates_from_pos(self, symbol: str, timeframe: str, pos: int, count: int):
                return self.rows[pos:pos + count]

            def copy_rates_range(self, symbol: str, timeframe: str, date_from, date_to):
                from_ts = int(date_from.astimezone(timezone.utc).timestamp())
                to_ts = int(date_to.astimezone(timezone.utc).timestamp())
                chronological = list(reversed(self.rows))
                return [row for row in chronological if from_ts <= int(row["time"]) <= to_ts]

        with tempfile.TemporaryDirectory() as tmp:
            store_root = Path(tmp)
            pull_mt5_m1_to_store_v6(
                symbol="XAUUSDm",
                mode="refresh",
                count=120,
                store_root=store_root,
                mt5_module=FakeMt5(make_rows(ANCHOR, 120)),
                batch_size=120,
            )
            aggregate_from_m1_store_v6(symbol="XAUUSDm", target_timeframes=["M5"], store_root=store_root, rebuild=True)
            pull_mt5_m1_to_store_v6(
                symbol="XAUUSDm",
                mode="incremental",
                store_root=store_root,
                mt5_module=FakeMt5(make_rows(ANCHOR, 130)),
                batch_size=20,
                current_time=ANCHOR + 130 * 60,
            )
            key = dataset_key(provider="mt5", symbol="XAUUSDm", mode="aggregated", timeframe="M5", base_timeframe="M1", anchor="UTC2200")
            manifest = load_manifest_v6(store_root)
            cell = manifest["datasets"][key]
            cell["sourceLastTime"] = ANCHOR + 129 * 60
            cell["lastOpenTime"] = ANCHOR + 115 * 60
            cell["lastTime"] = ANCHOR + 115 * 60
            cell["dirty"] = False
            save_manifest_v6(manifest, store_root)

            result = aggregate_from_m1_store_v6(symbol="XAUUSDm", target_timeframes=["M5"], store_root=store_root, rebuild=False)

            self.assertTrue(result["ok"])
            repaired = get_dataset_cell(store_root, key)
            self.assertGreaterEqual(repaired["lastOpenTime"], ANCHOR + 125 * 60)

    def test_audit_repairs_manifest_counts_and_marks_incomplete_aggregate_dirty(self) -> None:
        class FakeMt5:
            TIMEFRAME_M1 = "M1"

            def __init__(self) -> None:
                self.rows = list(reversed(make_rows(ANCHOR, 120)))

            def copy_rates_from_pos(self, symbol: str, timeframe: str, pos: int, count: int):
                return self.rows[pos:pos + count]

        with tempfile.TemporaryDirectory() as tmp:
            store_root = Path(tmp)
            pull_mt5_m1_to_store_v6(
                symbol="XAUUSDm",
                mode="refresh",
                count=120,
                store_root=store_root,
                mt5_module=FakeMt5(),
                batch_size=120,
            )
            aggregate_from_m1_store_v6(symbol="XAUUSDm", target_timeframes=["M5"], store_root=store_root, rebuild=True)
            key = dataset_key(provider="mt5", symbol="XAUUSDm", mode="aggregated", timeframe="M5", base_timeframe="M1", anchor="UTC2200")
            manifest = load_manifest_v6(store_root)
            manifest["datasets"][key]["rowsCount"] = 1
            manifest["datasets"][key]["lastOpenTime"] = ANCHOR
            manifest["datasets"][key]["lastTime"] = ANCHOR
            save_manifest_v6(manifest, store_root)

            audit = audit_store_v6("XAUUSDm", store_root=store_root, repair=True)

            self.assertTrue(audit["ok"])
            self.assertGreaterEqual(audit["repairedDatasets"], 1)
            repaired = get_dataset_cell(store_root, key)
            self.assertEqual(repaired["rowsCount"], 24)
            self.assertEqual(repaired["lastOpenTime"], ANCHOR + 115 * 60)

    def test_symbol_session_scan_writes_store_v6_rule_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store_root = Path(tmp)
            sync = sync_symbol_sessions_v6(
                [
                    {
                        "symbol": "XAUUSDm",
                        "name": "Gold",
                        "market": "forex_metal",
                        "sessions": {
                            "quote": ["", "00:00-21:00, 22:00-23:59", "00:00-21:00, 22:00-23:59"],
                            "trade": ["", "00:00-21:00, 22:00-23:59", "00:00-21:00, 22:00-23:59"],
                        },
                        "sessionsSource": "mql5_export",
                        "sessionsUpdatedAt": "2026-06-02 10:00:00",
                    }
                ],
                store_root=store_root,
                generated_at="2026-06-02T10:00:00Z",
            )
            self.assertTrue(sync["ok"])
            self.assertTrue(trading_rules_path(store_root).is_file())
            rule = read_symbol_session_rule_v6("XAUUSDm", store_root=store_root)
            self.assertIsNotNone(rule)
            self.assertEqual(rule["ruleVersion"], 1)
            self.assertEqual(rule["sessionAnchor"], "UTC2200")
            self.assertEqual(rule["tradeSessions"]["mon"][0], {"from": "00:00", "to": "21:00"})
            sync_symbol_sessions_v6(
                [{"symbol": "EURUSD", "name": "Euro / US Dollar", "sessions": {"quote": [""] * 7, "trade": [""] * 7}}],
                store_root=store_root,
                generated_at="2026-06-02T10:01:00Z",
            )
            self.assertIsNotNone(read_symbol_session_rule_v6("XAUUSDm", store_root=store_root))
            self.assertIsNotNone(read_symbol_session_rule_v6("EURUSD", store_root=store_root))
