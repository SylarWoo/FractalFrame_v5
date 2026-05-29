from __future__ import annotations

import unittest
from pathlib import Path

import pandas as pd

from python.indicators.mmf_v2 import MmfV2Settings, calculate_mmf_v2_markers
from python.indicators.mmf_v2.features import build_mmf_v2_features
from python.indicators.mmf_v2.models import MmfV2VdoSettings
from python.indicators.mmf_v2.state_machine import calculate_mmf_v2_state_machine_markers
from python.indicators.mmf_v2.stoch_state_machine import calculate_stoch_state_signals


REPO_ROOT = Path(__file__).resolve().parents[1]
XAUUSD_M5_MAY_2026 = (
    REPO_ROOT
    / "runtime_data"
    / "market_data_store_v5"
    / "datasets"
    / "provider=mt5"
    / "symbol=XAUUSDm"
    / "mode=aggregated"
    / "timeframe=M5"
    / "baseTimeframe=M1"
    / "anchor=UTC2200"
    / "year=2026"
    / "month=05"
    / "part-20260501-3afee672.parquet"
)


def synthetic_row(index: int, close: float) -> dict:
    return {
        "time": 1_700_000_000 + index * 300,
        "barKey": f"synthetic|M5|{index}",
        "open": close,
        "high": close + 0.5,
        "low": close - 0.5,
        "close": close,
        "volume": 1,
    }


class MmfV2RegressionTest(unittest.TestCase):
    def test_stoch_state_signal_coordinates_match_mmf_v2_marker_payload(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 101, 120, 108, 104, 102, 101])]
        features = pd.DataFrame(rows)
        features["stochK"] = [70, 72, 60, 58, 48, 45, 44]
        features["stochD"] = [60, 62, 65, 61, 55, 50, 49]
        settings = MmfV2Settings(
            show_high=True,
            show_low=False,
            high_anchor_lookback_bars=3,
            high_stoch_k_advance=10,
            high_confirm_lookahead_bars=2,
        )

        state_signals = calculate_stoch_state_signals(features, settings)
        markers = calculate_mmf_v2_state_machine_markers(features, settings)

        self.assertEqual(len(state_signals), 1)
        self.assertEqual(len(markers), 1)
        signal = state_signals[0]
        marker = markers[0]

        self.assertEqual(signal.cross.index, marker.event.index)
        self.assertEqual(signal.confirm.index, marker.confirm.index)
        self.assertEqual(signal.anchor.index, marker.marker.index)
        self.assertEqual(signal.entry_index, marker.entry.index)

    def test_xauusd_m5_real_market_snapshot_keeps_key_signal_coordinates(self) -> None:
        if not XAUUSD_M5_MAY_2026.exists():
            self.skipTest(f"fixture parquet not found: {XAUUSD_M5_MAY_2026}")

        frame = pd.read_parquet(XAUUSD_M5_MAY_2026)
        rows = frame[["time", "open", "high", "low", "close", "volume"]].to_dict("records")
        settings = MmfV2Settings(
            show_high=True,
            show_low=True,
            high_anchor_lookback_bars=14,
            low_anchor_lookback_bars=14,
            high_stoch_k_advance=10,
            low_stoch_k_advance=10,
            high_confirm_lookahead_bars=20,
            low_confirm_lookahead_bars=20,
        )

        payload = calculate_mmf_v2_markers(rows, settings)
        compact = [
            {
                "type": marker["type"],
                "eventIndex": marker["eventIndex"],
                "eventTime": marker["eventTime"],
                "confirmIndex": marker["confirmIndex"],
                "confirmTime": marker["confirmTime"],
                "markerIndex": marker["markerIndex"],
                "markerTime": marker["time"],
                "price": round(float(marker["price"]), 3),
                "entryIndex": marker["entryIndex"],
                "entryTime": marker["entryTime"],
                "entryPrice": round(float(marker["entryPrice"]), 3),
                "pointDistance": round(float(marker["pointDistance"]), 3),
            }
            for marker in payload["markers"][:5]
        ]

        self.assertEqual(payload["markersCount"], 312)
        self.assertEqual(
            compact,
            [
                {
                    "type": "MMF_V2_LOW",
                    "eventIndex": 41,
                    "eventTime": 1777605900,
                    "confirmIndex": 42,
                    "confirmTime": 1777606200,
                    "markerIndex": 35,
                    "markerTime": 1777604100,
                    "price": 4616.368,
                    "entryIndex": 42,
                    "entryTime": 1777606200,
                    "entryPrice": 4630.072,
                    "pointDistance": 13.704,
                },
                {
                    "type": "MMF_V2_HIGH",
                    "eventIndex": 48,
                    "eventTime": 1777608000,
                    "confirmIndex": 49,
                    "confirmTime": 1777608300,
                    "markerIndex": 43,
                    "markerTime": 1777606500,
                    "price": 4631.875,
                    "entryIndex": 49,
                    "entryTime": 1777608300,
                    "entryPrice": 4620.999,
                    "pointDistance": 10.876,
                },
                {
                    "type": "MMF_V2_HIGH",
                    "eventIndex": 69,
                    "eventTime": 1777614300,
                    "confirmIndex": 72,
                    "confirmTime": 1777615200,
                    "markerIndex": 56,
                    "markerTime": 1777610400,
                    "price": 4616.114,
                    "entryIndex": 72,
                    "entryTime": 1777615200,
                    "entryPrice": 4605.278,
                    "pointDistance": 10.836,
                },
                {
                    "type": "MMF_V2_LOW",
                    "eventIndex": 62,
                    "eventTime": 1777612200,
                    "confirmIndex": 64,
                    "confirmTime": 1777612800,
                    "markerIndex": 60,
                    "markerTime": 1777611600,
                    "price": 4607.296,
                    "entryIndex": 64,
                    "entryTime": 1777612800,
                    "entryPrice": 4614.776,
                    "pointDistance": 7.48,
                },
                {
                    "type": "MMF_V2_LOW",
                    "eventIndex": 83,
                    "eventTime": 1777618500,
                    "confirmIndex": 88,
                    "confirmTime": 1777620000,
                    "markerIndex": 80,
                    "markerTime": 1777617600,
                    "price": 4590.681,
                    "entryIndex": 88,
                    "entryTime": 1777620000,
                    "entryPrice": 4591.036,
                    "pointDistance": 0.355,
                },
            ],
        )

    def test_vdo_feature_frame_exposes_frontend_band_state(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 101, 102, 101, 100, 99, 98, 99, 100, 101, 102, 103])]
        settings = MmfV2Settings(
            vdo=MmfV2VdoSettings(
                length=2,
                ema_smoothing=0,
                zero_line_value=0,
                up_line_value=0.1,
                up_line2_value=0.05,
                down_line_value=-0.1,
                down_line2_value=-0.05,
            ),
        )

        features = build_mmf_v2_features(pd.DataFrame(rows), settings)

        self.assertIn("vdo", features.columns)
        self.assertIn("vdoZoneCode", features.columns)
        self.assertIn("vdoCrossUpUpper2", features.columns)
        self.assertIn("vdoCrossDownLower2", features.columns)
        self.assertIn(3, set(features["vdoZoneCode"].dropna().astype(int).tolist()))
        self.assertIn(-3, set(features["vdoZoneCode"].dropna().astype(int).tolist()))
        self.assertGreater(int(features["vdoCrossUpUpper2"].sum()), 0)
        self.assertGreater(int(features["vdoCrossDownLower2"].sum()), 0)

    def test_support_level_replaces_low_marker_inside_vdo_window(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 99, 97, 98, 100, 101, 102])]
        features = pd.DataFrame(rows)
        features["stochK"] = [30, 28, 25, 42, 52, 55, 58]
        features["stochD"] = [35, 34, 32, 40, 45, 50, 53]
        _attach_vdo_test_columns(features, [-0.04, -0.06, -0.08, -0.07, -0.06, -0.04, -0.03])
        settings = MmfV2Settings(
            show_low=False,
            show_support_level=True,
            show_high=False,
            low_anchor_lookback_bars=3,
            low_stoch_k_advance=10,
            low_confirm_lookahead_bars=2,
        )

        markers = calculate_mmf_v2_state_machine_markers(features, settings)

        self.assertEqual(len(markers), 1)
        self.assertEqual(markers[0].type, "MMF_V2_SUPPORT")
        self.assertEqual(markers[0].marker.index, 2)
        self.assertIn("support_vdo_down_up_neg_0_05_no_below_neg_0_10", markers[0].reason)

    def test_resistance_level_replaces_high_marker_inside_vdo_window(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 101, 103, 102, 100, 99, 98])]
        features = pd.DataFrame(rows)
        features["stochK"] = [70, 72, 76, 58, 46, 42, 40]
        features["stochD"] = [65, 66, 70, 60, 55, 48, 45]
        _attach_vdo_test_columns(features, [0.04, 0.06, 0.08, 0.07, 0.06, 0.04, 0.03])
        settings = MmfV2Settings(
            show_high=False,
            show_resistance_level=True,
            show_low=False,
            high_anchor_lookback_bars=3,
            high_stoch_k_advance=10,
            high_confirm_lookahead_bars=2,
        )

        markers = calculate_mmf_v2_state_machine_markers(features, settings)

        self.assertEqual(len(markers), 1)
        self.assertEqual(markers[0].type, "MMF_V2_RESISTANCE")
        self.assertEqual(markers[0].marker.index, 2)
        self.assertIn("resistance_vdo_up_down_0_05_no_above_0_10", markers[0].reason)


def _attach_vdo_test_columns(features: pd.DataFrame, values: list[float]) -> None:
    vdo = pd.Series(values)
    previous = vdo.shift(1)
    features["vdo"] = vdo
    features["vdoCrossDownLower2"] = (previous > -0.05) & (vdo <= -0.05)
    features["vdoCrossUpLower2"] = (previous < -0.05) & (vdo >= -0.05)
    features["vdoCrossDownLower"] = (previous > -0.1) & (vdo <= -0.1)
    features["vdoCrossUpLower"] = (previous < -0.1) & (vdo >= -0.1)
    features["vdoCrossUpUpper2"] = (previous < 0.05) & (vdo >= 0.05)
    features["vdoCrossDownUpper2"] = (previous > 0.05) & (vdo <= 0.05)
    features["vdoCrossUpUpper"] = (previous < 0.1) & (vdo >= 0.1)
    features["vdoCrossDownUpper"] = (previous > 0.1) & (vdo <= 0.1)


if __name__ == "__main__":
    unittest.main()
