from __future__ import annotations

import unittest
from pathlib import Path

import pandas as pd

from python.indicators.mmf_v2 import MmfV2Settings, calculate_mmf_v2_markers
from python.indicators.mmf_v2.features import build_mmf_v2_features
from python.indicators.mmf_v2.models import MmfV2VdoSettings
from python.indicators.mmf_v2.state_machine import calculate_mmf_v2_state_machine_markers
from python.indicators.mmf_v2.stoch_state_machine import PriceAnchor, StochConfirmEvent, StochCrossEvent, StochStateSignal, calculate_stoch_state_signals
from python.indicators.mmf_v2.tsi_crosses import create_tsi_cross_markers
from python.indicators.mmf_v2.vmi_divergence import apply_vmi_divergence_classifications


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


def _manual_stoch_signal(features: pd.DataFrame, side: str, anchor_index: int, cross_index: int, confirm_index: int) -> StochStateSignal:
    price_column = "low" if side == "low" else "high"
    anchor_price = float(features[price_column].iloc[anchor_index])
    cross = StochCrossEvent(
        direction="golden" if side == "low" else "dead",
        index=cross_index,
        bar_key=str(features["barKey"].iloc[cross_index]),
        time=int(features["time"].iloc[cross_index]),
        value=float(features["stochK"].iloc[cross_index]),
        k=float(features["stochK"].iloc[cross_index]),
        d=float(features["stochD"].iloc[cross_index]),
        previous_index=max(0, cross_index - 1),
        previous_k=float(features["stochK"].iloc[max(0, cross_index - 1)]),
        previous_d=float(features["stochD"].iloc[max(0, cross_index - 1)]),
    )
    confirm = StochConfirmEvent(
        cross=cross,
        index=confirm_index,
        bar_key=str(features["barKey"].iloc[confirm_index]),
        time=int(features["time"].iloc[confirm_index]),
        k=float(features["stochK"].iloc[confirm_index]),
        advance=10,
        bars_used=max(0, confirm_index - cross_index),
        max_bars=7,
    )
    anchor = PriceAnchor(
        type=side,
        index=anchor_index,
        bar_key=str(features["barKey"].iloc[anchor_index]),
        time=int(features["time"].iloc[anchor_index]),
        price=anchor_price,
        window_start_index=max(0, cross_index - 2),
        window_start_bar_key=str(features["barKey"].iloc[max(0, cross_index - 2)]),
        window_start_time=int(features["time"].iloc[max(0, cross_index - 2)]),
        window_end_index=cross_index,
        window_end_bar_key=str(features["barKey"].iloc[cross_index]),
        window_end_time=int(features["time"].iloc[cross_index]),
    )
    return StochStateSignal(
        type=side,
        cross=cross,
        confirm=confirm,
        anchor=anchor,
        entry_index=confirm_index,
        entry_bar_key=str(features["barKey"].iloc[confirm_index]),
        entry_time=int(features["time"].iloc[confirm_index]),
        entry_price=float(features["close"].iloc[confirm_index]),
        point_distance=abs(float(features["close"].iloc[confirm_index]) - anchor_price),
    )


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

    def test_stoch_state_merges_consecutive_highs_to_highest_anchor(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 101, 99, 98, 97, 96])]
        features = pd.DataFrame(rows)
        features["high"] = [110, 111, 109, 112, 121, 108]
        features["stochK"] = [70, 50, 35, 65, 50, 35]
        features["stochD"] = [60, 60, 55, 55, 60, 55]
        settings = MmfV2Settings(
            show_high=True,
            show_low=True,
            high_anchor_lookback_bars=3,
            high_stoch_k_advance=10,
            high_confirm_lookahead_bars=2,
            low_stoch_k_advance=20,
            low_confirm_lookahead_bars=1,
        )

        state_signals = calculate_stoch_state_signals(features, settings)

        self.assertEqual([signal.type for signal in state_signals], ["high"])
        self.assertEqual(state_signals[0].anchor.index, 4)
        self.assertEqual(state_signals[0].anchor.price, 121)

    def test_bottom_divergence_uses_first_support_in_oversold_epoch_as_base(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 98, 99, 96, 97])]
        features = pd.DataFrame(rows)
        features["low"] = [99, 94, 96, 92, 95]
        features["stochK"] = [20, 18, 35, 20, 40]
        features["stochD"] = [25, 22, 25, 22, 30]
        features["vmiHistogram"] = [-0.08, -0.14, -0.12, -0.09, -0.06]
        features["vdoOversoldActive"] = [False, True, True, True, False]
        features["vdoOversoldEpoch"] = [None, 0, 0, 0, None]
        settings = MmfV2Settings(show_bottom_divergence_point=True)
        signals = [
            _manual_stoch_signal(features, "low", anchor_index=1, cross_index=1, confirm_index=2),
            _manual_stoch_signal(features, "low", anchor_index=3, cross_index=3, confirm_index=4),
        ]

        classifications = apply_vmi_divergence_classifications(
            features,
            signals,
            settings,
            {0: ("MMF_V2_SUPPORT", "support_base")},
        )

        self.assertEqual(classifications[0][0], "MMF_V2_SUPPORT")
        self.assertEqual(classifications[1][0], "MMF_V2_BOTTOM_DIVERGENCE")

    def test_top_divergence_uses_first_resistance_in_overbought_epoch_as_base(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 102, 101, 105, 103])]
        features = pd.DataFrame(rows)
        features["high"] = [101, 106, 103, 109, 104]
        features["stochK"] = [70, 82, 65, 84, 60]
        features["stochD"] = [65, 75, 70, 78, 70]
        features["vmiHistogram"] = [0.08, 0.14, 0.12, 0.09, 0.06]
        features["vdoOverboughtActive"] = [False, True, True, True, False]
        features["vdoOverboughtEpoch"] = [None, 0, 0, 0, None]
        settings = MmfV2Settings(show_top_divergence_point=True)
        signals = [
            _manual_stoch_signal(features, "high", anchor_index=1, cross_index=1, confirm_index=2),
            _manual_stoch_signal(features, "high", anchor_index=3, cross_index=3, confirm_index=4),
        ]

        classifications = apply_vmi_divergence_classifications(
            features,
            signals,
            settings,
            {0: ("MMF_V2_RESISTANCE", "resistance_base")},
        )

        self.assertEqual(classifications[0][0], "MMF_V2_RESISTANCE")
        self.assertEqual(classifications[1][0], "MMF_V2_TOP_DIVERGENCE")

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

    def test_mmf_v2_internal_ma_uses_sma120_hlc3(self) -> None:
        rows = []
        hlc3_values = []
        for index in range(121):
            close = 100 + index
            row = synthetic_row(index, close)
            row["high"] = close + 3
            row["low"] = close - 1
            rows.append(row)
            hlc3_values.append((row["high"] + row["low"] + row["close"]) / 3)

        features = build_mmf_v2_features(pd.DataFrame(rows), MmfV2Settings())
        expected = sum(hlc3_values[1:121]) / 120

        self.assertTrue(pd.isna(features["ma"].iloc[118]))
        self.assertAlmostEqual(float(features["ma"].iloc[120]), expected)

    def test_support_level_replaces_low_marker_inside_vdo_window(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 99, 97, 98, 100, 101, 102])]
        features = pd.DataFrame(rows)
        features["stochK"] = [30, 28, 25, 42, 52, 55, 58]
        features["stochD"] = [35, 34, 32, 40, 45, 50, 53]
        _attach_vdo_test_columns(features, [-0.04, -0.06, -0.08, -0.07, -0.06, -0.04, -0.03])
        features.loc[1, "vmiCrossDownZero"] = True
        features.loc[5, "vmiCrossUpZero"] = True
        settings = MmfV2Settings(
            show_low=False,
            show_support_level=True,
            show_high=True,
            low_anchor_lookback_bars=3,
            low_stoch_k_advance=10,
            low_confirm_lookahead_bars=2,
        )

        markers = calculate_mmf_v2_state_machine_markers(features, settings)

        self.assertEqual(len(markers), 1)
        self.assertEqual(markers[0].type, "MMF_V2_SUPPORT")
        self.assertEqual(markers[0].marker.index, 2)
        self.assertTrue(any("support_vdo_level_5_neg_0_05_boundary_neg_0_10" in reason for reason in markers[0].reason))
        self.assertTrue(any("source_vdo_window" in reason for reason in markers[0].reason))

    def test_resistance_level_replaces_high_marker_inside_vdo_window(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 101, 103, 102, 100, 99, 98])]
        features = pd.DataFrame(rows)
        features["stochK"] = [70, 72, 76, 58, 46, 42, 40]
        features["stochD"] = [65, 66, 70, 60, 55, 48, 45]
        _attach_vdo_test_columns(features, [0.04, 0.06, 0.08, 0.07, 0.06, 0.04, 0.03])
        features.loc[1, "vmiCrossUpZero"] = True
        features.loc[5, "vmiCrossDownZero"] = True
        settings = MmfV2Settings(
            show_high=True,
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
        self.assertTrue(any("resistance_vdo_level_5_0_05_boundary_0_10" in reason for reason in markers[0].reason))
        self.assertTrue(any("source_vdo_window" in reason for reason in markers[0].reason))

    def test_top_divergence_ui_toggle_does_not_create_backend_marker(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 101, 103, 102, 100, 99, 100, 104, 106, 105, 103, 102])]
        features = pd.DataFrame(rows)
        features["stochK"] = [70, 72, 76, 58, 46, 42, 50, 72, 76, 58, 46, 42]
        features["stochD"] = [65, 66, 70, 60, 55, 48, 45, 66, 70, 60, 55, 48]
        features["vmiHistogram"] = [0.0, 0.0, 0.10, 0.0, 0.0, 0.0, 0.0, 0.0, 0.05, 0.0, 0.0, 0.0]
        _attach_vdo_test_columns(features, [0.04, 0.11, 0.12, 0.13, 0.12, 0.11, 0.12, 0.13, 0.14, 0.12, 0.11, 0.04])
        features.loc[1, "vmiCrossUpZero"] = True
        features.loc[5, "vmiCrossDownZero"] = True
        features.loc[8, "vmiCrossUpZero"] = True
        features.loc[11, "vmiCrossDownZero"] = True
        settings = MmfV2Settings(
            show_high=True,
            show_resistance_level=True,
            show_top_divergence_point=True,
            show_low=False,
            high_anchor_lookback_bars=3,
            high_stoch_k_advance=10,
            high_confirm_lookahead_bars=2,
        )

        markers = calculate_mmf_v2_state_machine_markers(features, settings)

        self.assertFalse(any(marker.type == "MMF_V2_TOP_DIVERGENCE" for marker in markers))

    def test_bottom_divergence_ui_toggle_does_not_create_backend_marker(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 99, 97, 98, 100, 101, 100, 96, 94, 95, 97, 98])]
        features = pd.DataFrame(rows)
        features["stochK"] = [30, 28, 25, 42, 52, 55, 50, 28, 24, 42, 52, 55]
        features["stochD"] = [35, 34, 32, 40, 45, 50, 55, 34, 30, 40, 45, 50]
        features["vmiHistogram"] = [0.0, 0.0, -0.10, 0.0, 0.0, 0.0, 0.0, 0.0, -0.05, 0.0, 0.0, 0.0]
        _attach_vdo_test_columns(features, [-0.04, -0.11, -0.12, -0.13, -0.12, -0.11, -0.12, -0.13, -0.14, -0.12, -0.11, -0.04])
        features.loc[1, "vmiCrossDownZero"] = True
        features.loc[5, "vmiCrossUpZero"] = True
        features.loc[8, "vmiCrossDownZero"] = True
        features.loc[11, "vmiCrossUpZero"] = True
        settings = MmfV2Settings(
            show_low=True,
            show_support_level=True,
            show_bottom_divergence_point=True,
            show_high=False,
            low_anchor_lookback_bars=3,
            low_stoch_k_advance=10,
            low_confirm_lookahead_bars=2,
        )

        markers = calculate_mmf_v2_state_machine_markers(features, settings)

        self.assertFalse(any(marker.type == "MMF_V2_BOTTOM_DIVERGENCE" for marker in markers))

    def test_vmi_divergence_starts_from_second_point_after_vdo_threshold_entry(self) -> None:
        top_rows = [synthetic_row(index, close) for index, close in enumerate([100, 101, 103, 102, 100, 99, 100, 104, 106, 105, 103, 102])]
        top_features = pd.DataFrame(top_rows)
        top_features["stochK"] = [70, 72, 76, 58, 46, 42, 50, 72, 76, 58, 46, 42]
        top_features["stochD"] = [65, 66, 70, 60, 55, 48, 45, 66, 70, 60, 55, 48]
        top_features["vmiHistogram"] = [0.0, 0.0, 0.10, 0.0, 0.0, 0.0, 0.0, 0.0, 0.05, 0.0, 0.0, 0.0]
        _attach_vdo_test_columns(top_features, [0.04, 0.06, 0.08, 0.07, 0.06, 0.04, 0.03, 0.11, 0.12, 0.11, 0.10, 0.04])
        top_settings = MmfV2Settings(
            show_high=False,
            show_top_divergence_point=True,
            show_low=False,
            high_anchor_lookback_bars=3,
            high_stoch_k_advance=10,
            high_confirm_lookahead_bars=2,
        )

        top_markers = calculate_mmf_v2_state_machine_markers(top_features, top_settings)

        self.assertFalse(any(marker.type == "MMF_V2_TOP_DIVERGENCE" for marker in top_markers))

        bottom_rows = [synthetic_row(index, close) for index, close in enumerate([100, 99, 97, 98, 100, 101, 100, 96, 94, 95, 97, 98])]
        bottom_features = pd.DataFrame(bottom_rows)
        bottom_features["stochK"] = [30, 28, 25, 42, 52, 55, 50, 28, 24, 42, 52, 55]
        bottom_features["stochD"] = [35, 34, 32, 40, 45, 50, 55, 34, 30, 40, 45, 50]
        bottom_features["vmiHistogram"] = [0.0, 0.0, -0.10, 0.0, 0.0, 0.0, 0.0, 0.0, -0.05, 0.0, 0.0, 0.0]
        _attach_vdo_test_columns(bottom_features, [-0.04, -0.06, -0.08, -0.07, -0.06, -0.04, -0.03, -0.11, -0.12, -0.11, -0.10, -0.04])
        bottom_settings = MmfV2Settings(
            show_low=False,
            show_bottom_divergence_point=True,
            show_high=False,
            low_anchor_lookback_bars=3,
            low_stoch_k_advance=10,
            low_confirm_lookahead_bars=2,
        )

        bottom_markers = calculate_mmf_v2_state_machine_markers(bottom_features, bottom_settings)

        self.assertFalse(any(marker.type == "MMF_V2_BOTTOM_DIVERGENCE" for marker in bottom_markers))

    def test_vmi_divergence_resets_first_point_after_each_vdo_reentry(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 101, 103, 102, 104, 106, 105, 100, 108, 107, 106])]
        features = pd.DataFrame(rows)
        features["stochK"] = [70, 72, 76, 58, 50, 76, 58, 50, 76, 58, 42]
        features["stochD"] = [65, 66, 70, 60, 55, 70, 60, 55, 70, 60, 48]
        features["vmiHistogram"] = [0.0, 0.0, 0.10, 0.0, 0.0, 0.05, 0.0, 0.0, 0.03, 0.0, 0.0]
        _attach_vdo_test_columns(features, [0.04, 0.11, 0.12, 0.08, 0.11, 0.12, 0.08, 0.09, 0.11, 0.12, 0.08])
        settings = MmfV2Settings(
            show_high=True,
            show_top_divergence_point=True,
            show_low=False,
            high_anchor_lookback_bars=3,
            high_stoch_k_advance=10,
            high_confirm_lookahead_bars=2,
        )

        markers = calculate_mmf_v2_state_machine_markers(features, settings)

        self.assertFalse(any(marker.type == "MMF_V2_TOP_DIVERGENCE" for marker in markers))

    def test_vmi_divergence_closes_overbought_on_cross_down_upper_line(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 101, 103, 102, 104, 106, 105, 100, 108, 107, 106])]
        features = pd.DataFrame(rows)
        features["stochK"] = [70, 72, 76, 58, 50, 76, 58, 50, 76, 58, 42]
        features["stochD"] = [65, 66, 70, 60, 55, 70, 60, 55, 70, 60, 48]
        features["vmiHistogram"] = [0.0, 0.0, 0.10, 0.0, 0.0, 0.05, 0.0, 0.0, 0.03, 0.0, 0.0]
        _attach_vdo_test_columns(features, [0.04, 0.11, 0.12, 0.12, 0.12, 0.12, 0.10, 0.08, 0.11, 0.12, 0.08])
        settings = MmfV2Settings(
            show_high=True,
            show_top_divergence_point=True,
            show_low=False,
            high_anchor_lookback_bars=3,
            high_stoch_k_advance=10,
            high_confirm_lookahead_bars=2,
        )

        markers = calculate_mmf_v2_state_machine_markers(features, settings)
        top_divergence_indices = [marker.marker.index for marker in markers if marker.type == "MMF_V2_TOP_DIVERGENCE"]

        self.assertEqual(top_divergence_indices, [])

    def test_vmi_bottom_divergence_classification_is_disabled(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 99, 96, 98, 97, 94, 95, 96])]
        features = pd.DataFrame(rows)
        features["stochK"] = [30, 28, 24, 42, 35, 24, 42, 52]
        features["stochD"] = [35, 34, 30, 40, 38, 30, 40, 45]
        features["vmiHistogram"] = [0.0, 0.0, -0.14, 0.0, 0.0, -0.09, 0.0, 0.0]
        _attach_vdo_test_columns(features, [-0.04, -0.11, -0.12, -0.12, -0.12, -0.09, -0.08, -0.07])
        settings = MmfV2Settings(
            show_low=True,
            show_bottom_divergence_point=True,
            show_high=False,
            low_anchor_lookback_bars=3,
            low_stoch_k_advance=10,
            low_confirm_lookahead_bars=2,
        )

        signals = [
            _manual_stoch_signal(features, "low", 2, 2, 3),
            _manual_stoch_signal(features, "low", 5, 5, 6),
        ]
        classifications = apply_vmi_divergence_classifications(features, signals, settings, {0: ("MMF_V2_SUPPORT", "test_support_baseline")})

        self.assertNotIn(1, classifications)

    def test_vmi_bottom_divergence_disabled_even_when_low_is_hidden(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 99, 96, 98, 97, 94, 95, 96])]
        features = pd.DataFrame(rows)
        features["stochK"] = [30, 28, 24, 42, 35, 24, 42, 52]
        features["stochD"] = [35, 34, 30, 40, 38, 30, 40, 45]
        features["vmiHistogram"] = [0.0, 0.0, -0.14, 0.0, 0.0, -0.09, 0.0, 0.0]
        _attach_vdo_test_columns(features, [-0.04, -0.11, -0.12, -0.12, -0.12, -0.09, -0.08, -0.07])
        settings = MmfV2Settings(
            show_low=False,
            show_bottom_divergence_point=True,
            show_high=False,
        )
        signals = [
            _manual_stoch_signal(features, "low", 2, 2, 3),
            _manual_stoch_signal(features, "low", 5, 5, 6),
        ]

        classifications = apply_vmi_divergence_classifications(features, signals, settings, {0: ("MMF_V2_SUPPORT", "test_support_baseline")})

        self.assertNotIn(1, classifications)

    def test_vmi_bottom_divergence_disabled_for_negative_momentum_cases(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 99, 96, 98, 97, 95, 96, 94, 95])]
        features = pd.DataFrame(rows)
        features["stochK"] = [30, 28, 24, 42, 35, 24, 42, 24, 42]
        features["stochD"] = [35, 34, 30, 40, 38, 30, 40, 30, 40]
        features["vmiHistogram"] = [0.0, 0.0, -0.0358, 0.0, 0.0, -0.0351, 0.0, -0.0359, 0.0]
        _attach_vdo_test_columns(features, [-0.04, -0.11, -0.12, -0.12, -0.12, -0.12, -0.12, -0.12, -0.08])
        settings = MmfV2Settings(
            show_low=False,
            show_bottom_divergence_point=True,
            show_high=False,
        )
        signals = [
            _manual_stoch_signal(features, "low", 2, 2, 3),
            _manual_stoch_signal(features, "low", 5, 5, 6),
            _manual_stoch_signal(features, "low", 7, 7, 8),
        ]

        classifications = apply_vmi_divergence_classifications(features, signals, settings, {0: ("MMF_V2_SUPPORT", "test_support_baseline")})

        self.assertNotIn(1, classifications)
        self.assertNotEqual(classifications.get(2, (None,))[0], "MMF_V2_BOTTOM_DIVERGENCE")

    def test_vmi_bottom_divergence_keeps_support_as_epoch_baseline(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 99, 96, 98, 97, 97, 98, 95.5, 96])]
        features = pd.DataFrame(rows)
        features["stochK"] = [30, 28, 24, 42, 35, 24, 42, 24, 42]
        features["stochD"] = [35, 34, 30, 40, 38, 30, 40, 30, 40]
        features["vmiHistogram"] = [0.0, 0.0, -0.14, 0.0, 0.0, -0.20, 0.0, -0.15, 0.0]
        _attach_vdo_test_columns(features, [-0.04, -0.11, -0.12, -0.12, -0.12, -0.12, -0.12, -0.12, -0.08])
        settings = MmfV2Settings(
            show_low=False,
            show_bottom_divergence_point=True,
            show_high=False,
        )
        signals = [
            _manual_stoch_signal(features, "low", 2, 2, 3),
            _manual_stoch_signal(features, "low", 5, 5, 6),
            _manual_stoch_signal(features, "low", 7, 7, 8),
        ]

        classifications = apply_vmi_divergence_classifications(features, signals, settings, {0: ("MMF_V2_SUPPORT", "test_support_baseline")})

        self.assertNotEqual(classifications.get(2, (None,))[0], "MMF_V2_BOTTOM_DIVERGENCE")

    def test_vmi_divergence_does_not_use_hidden_first_point_after_vdo_entry_as_baseline(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 99, 97, 98, 100, 101, 100, 96, 94, 95, 97, 98])]
        features = pd.DataFrame(rows)
        features["stochK"] = [30, 28, 25, 42, 52, 55, 50, 28, 24, 42, 52, 55]
        features["stochD"] = [35, 34, 32, 40, 45, 50, 55, 34, 30, 40, 45, 50]
        features["vmiHistogram"] = [0.0, 0.0, -0.10, 0.0, 0.0, 0.0, 0.0, 0.0, -0.05, 0.0, 0.0, 0.0]
        _attach_vdo_test_columns(features, [-0.04, -0.11, -0.12, -0.13, -0.12, -0.11, -0.12, -0.13, -0.14, -0.12, -0.11, -0.04])
        settings = MmfV2Settings(
            show_low=False,
            show_bottom_divergence_point=True,
            show_high=False,
            low_anchor_lookback_bars=3,
            low_stoch_k_advance=10,
            low_confirm_lookahead_bars=2,
        )

        markers = calculate_mmf_v2_state_machine_markers(features, settings)

        self.assertFalse(any(marker.type == "MMF_V2_BOTTOM_DIVERGENCE" for marker in markers))

    def test_vmi_divergence_side_is_limited_by_vdo_overbought_oversold_zone(self) -> None:
        top_rows = [synthetic_row(index, close) for index, close in enumerate([100, 101, 103, 102, 100, 99, 100, 104, 106, 105, 103, 102])]
        top_features = pd.DataFrame(top_rows)
        top_features["stochK"] = [70, 72, 76, 58, 46, 42, 50, 72, 76, 58, 46, 42]
        top_features["stochD"] = [65, 66, 70, 60, 55, 48, 45, 66, 70, 60, 55, 48]
        top_features["vmiHistogram"] = [0.0, 0.0, 0.10, 0.0, 0.0, 0.0, 0.0, 0.0, 0.05, 0.0, 0.0, 0.0]
        _attach_vdo_test_columns(top_features, [-0.12] * len(top_rows))
        top_settings = MmfV2Settings(
            show_high=False,
            show_top_divergence_point=True,
            show_low=False,
            high_anchor_lookback_bars=3,
            high_stoch_k_advance=10,
            high_confirm_lookahead_bars=2,
        )

        top_markers = calculate_mmf_v2_state_machine_markers(top_features, top_settings)

        self.assertFalse(any(marker.type == "MMF_V2_TOP_DIVERGENCE" for marker in top_markers))

        bottom_rows = [synthetic_row(index, close) for index, close in enumerate([100, 99, 97, 98, 100, 101, 100, 96, 94, 95, 97, 98])]
        bottom_features = pd.DataFrame(bottom_rows)
        bottom_features["stochK"] = [30, 28, 25, 42, 52, 55, 50, 28, 24, 42, 52, 55]
        bottom_features["stochD"] = [35, 34, 32, 40, 45, 50, 55, 34, 30, 40, 45, 50]
        bottom_features["vmiHistogram"] = [0.0, 0.0, -0.10, 0.0, 0.0, 0.0, 0.0, 0.0, -0.05, 0.0, 0.0, 0.0]
        _attach_vdo_test_columns(bottom_features, [0.12] * len(bottom_rows))
        bottom_settings = MmfV2Settings(
            show_low=False,
            show_bottom_divergence_point=True,
            show_high=False,
            low_anchor_lookback_bars=3,
            low_stoch_k_advance=10,
            low_confirm_lookahead_bars=2,
        )

        bottom_markers = calculate_mmf_v2_state_machine_markers(bottom_features, bottom_settings)

        self.assertFalse(any(marker.type == "MMF_V2_BOTTOM_DIVERGENCE" for marker in bottom_markers))

    def test_vdo_market_points_are_created_from_vdo_base_ma_crosses(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 101, 102, 103, 104])]
        features = pd.DataFrame(rows)
        features["stochK"] = [50] * len(rows)
        features["stochD"] = [50] * len(rows)
        _attach_vdo_test_columns(features, [-0.04, -0.01, 0.03, 0.01, -0.02])
        features["vdoBaseMa"] = [0.0] * len(rows)
        features["vdoCrossUpBaseMa"] = [False, False, True, False, False]
        features["vdoCrossDownBaseMa"] = [False, False, False, False, True]
        settings = MmfV2Settings(
            show_high=False,
            show_low=False,
            show_bull_market_point=True,
            show_bear_market_point=True,
        )

        markers = calculate_mmf_v2_state_machine_markers(features, settings)
        by_type = {marker.type: marker for marker in markers}

        self.assertEqual(by_type["MMF_V2_BULL_MARKET"].marker.index, 2)
        self.assertEqual(by_type["MMF_V2_BULL_MARKET"].marker.price, rows[2]["low"])
        self.assertEqual(by_type["MMF_V2_BEAR_MARKET"].marker.index, 4)
        self.assertEqual(by_type["MMF_V2_BEAR_MARKET"].marker.price, rows[4]["high"])

    def test_vdo_overbought_oversold_open_close_points_use_threshold_cross_bars(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 101, 102, 103, 104, 105, 106, 107])]
        features = pd.DataFrame(rows)
        features["stochK"] = [50] * len(rows)
        features["stochD"] = [50] * len(rows)
        _attach_vdo_test_columns(features, [0.09, 0.11, 0.12, 0.08, -0.09, -0.11, -0.12, -0.08])
        settings = MmfV2Settings(
            show_high=False,
            show_low=False,
            show_overbought_point=True,
            show_overbought_close_point=True,
            show_oversold_point=True,
            show_oversold_close_point=True,
        )

        markers = calculate_mmf_v2_state_machine_markers(features, settings)
        by_type = {marker.type: marker for marker in markers}

        self.assertEqual(by_type["MMF_V2_OVERBOUGHT"].marker.index, 1)
        self.assertEqual(by_type["MMF_V2_OVERBOUGHT"].marker.price, rows[1]["low"])
        self.assertEqual(by_type["MMF_V2_OVERBOUGHT_CLOSE"].marker.index, 3)
        self.assertEqual(by_type["MMF_V2_OVERBOUGHT_CLOSE"].marker.price, rows[3]["high"])
        self.assertEqual(by_type["MMF_V2_OVERSOLD"].marker.index, 5)
        self.assertEqual(by_type["MMF_V2_OVERSOLD"].marker.price, rows[5]["high"])
        self.assertEqual(by_type["MMF_V2_OVERSOLD_CLOSE"].marker.index, 7)
        self.assertEqual(by_type["MMF_V2_OVERSOLD_CLOSE"].marker.price, rows[7]["low"])

    def test_vdo_overbought_oversold_points_use_vdo_line_values_not_fixed_defaults(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 101, 102, 103, 104, 105])]
        features = pd.DataFrame(rows)
        features["stochK"] = [50] * len(rows)
        features["stochD"] = [50] * len(rows)
        _attach_vdo_test_columns(features, [0.15, 0.21, 0.19, -0.15, -0.21, -0.19])
        features["vdoUpLineValue"] = 0.2
        features["vdoDownLineValue"] = -0.2
        settings = MmfV2Settings(
            show_high=False,
            show_low=False,
            show_overbought_point=True,
            show_overbought_close_point=True,
            show_oversold_point=True,
            show_oversold_close_point=True,
        )

        markers = calculate_mmf_v2_state_machine_markers(features, settings)
        by_type = {marker.type: marker for marker in markers}

        self.assertEqual(by_type["MMF_V2_OVERBOUGHT"].marker.index, 1)
        self.assertEqual(by_type["MMF_V2_OVERBOUGHT_CLOSE"].marker.index, 2)
        self.assertEqual(by_type["MMF_V2_OVERSOLD"].marker.index, 4)
        self.assertEqual(by_type["MMF_V2_OVERSOLD_CLOSE"].marker.index, 5)

    def test_vdo_overbought_oversold_points_use_outer_band_when_band_order_is_swapped(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 101, 102, 103, 104, 105])]
        features = pd.DataFrame(rows)
        features["stochK"] = [50] * len(rows)
        features["stochD"] = [50] * len(rows)
        _attach_vdo_test_columns(features, [0.04, 0.06, 0.11, -0.04, -0.06, -0.11])
        features["vdoUpLineValue"] = 0.05
        features["vdoUpLine2Value"] = 0.1
        features["vdoDownLineValue"] = -0.05
        features["vdoDownLine2Value"] = -0.1
        settings = MmfV2Settings(
            show_high=False,
            show_low=False,
            show_overbought_point=True,
            show_oversold_point=True,
        )

        markers = calculate_mmf_v2_state_machine_markers(features, settings)
        by_type = {marker.type: marker for marker in markers}

        self.assertEqual(by_type["MMF_V2_OVERBOUGHT"].marker.index, 2)
        self.assertEqual(by_type["MMF_V2_OVERSOLD"].marker.index, 5)

    def test_trend_retrace_points_use_vdo_zone_stoch_side_and_vmi_direction(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 99, 100, 101, 103, 102, 100, 99, 98, 99, 100])]
        features = pd.DataFrame(rows)
        features["stochK"] = [50, 50, 70, 72, 76, 58, 46, 42, 30, 42, 52]
        features["stochD"] = [50, 50, 65, 66, 70, 60, 55, 48, 35, 40, 45]
        _attach_vdo_test_columns(features, [-0.09, -0.11, -0.12, -0.12, -0.12, -0.08, 0.08, 0.11, 0.12, 0.12, 0.08])
        features["vdoOversoldActive"] = False
        features["vdoOverboughtActive"] = False
        features["vmiHistogram"] = 0.0
        features.loc[4, "vdoOversoldActive"] = True
        features.loc[4, "vmiHistogram"] = 0.25
        features["vdoBearMarketActive"] = False
        features.loc[4, "vdoBearMarketActive"] = True
        features.loc[8, "vdoOverboughtActive"] = True
        features.loc[8, "vmiHistogram"] = -0.25
        features["vdoBullMarketActive"] = False
        features.loc[8, "vdoBullMarketActive"] = True
        settings = MmfV2Settings(
            show_trend_down_rebound_point=True,
            show_trend_up_pullback_point=True,
            high_anchor_lookback_bars=3,
            high_stoch_k_advance=10,
            high_confirm_lookahead_bars=2,
            low_anchor_lookback_bars=3,
            low_stoch_k_advance=10,
            low_confirm_lookahead_bars=2,
        )

        markers = calculate_mmf_v2_state_machine_markers(features, settings)
        by_type = {marker.type: marker for marker in markers}

        self.assertEqual(by_type["MMF_V2_TREND_DOWN_REBOUND"].marker.index, 4)
        self.assertIn("trend_down_rebound_oversold_active_high_or_resistance_positive_vmi", by_type["MMF_V2_TREND_DOWN_REBOUND"].reason)
        self.assertEqual(by_type["MMF_V2_TREND_UP_PULLBACK"].marker.index, 8)
        self.assertIn("trend_up_pullback_overbought_active_low_or_support_negative_vmi", by_type["MMF_V2_TREND_UP_PULLBACK"].reason)

    def test_trend_retrace_points_require_matching_market_state(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 99, 100, 101, 103, 102, 100, 99, 98, 99, 100])]
        features = pd.DataFrame(rows)
        features["stochK"] = [50, 50, 70, 72, 76, 58, 46, 42, 30, 42, 52]
        features["stochD"] = [50, 50, 65, 66, 70, 60, 55, 48, 35, 40, 45]
        _attach_vdo_test_columns(features, [-0.09, -0.11, -0.12, -0.12, -0.12, -0.08, 0.08, 0.11, 0.12, 0.12, 0.08])
        features["vdoOversoldActive"] = False
        features["vdoOverboughtActive"] = False
        features["vmiHistogram"] = 0.0
        features.loc[4, "vdoOversoldActive"] = True
        features.loc[4, "vmiHistogram"] = 0.25
        features.loc[8, "vdoOverboughtActive"] = True
        features.loc[8, "vmiHistogram"] = -0.25
        features["vdoBearMarketActive"] = False
        features["vdoBullMarketActive"] = False
        settings = MmfV2Settings(
            show_trend_down_rebound_point=True,
            show_trend_up_pullback_point=True,
            high_anchor_lookback_bars=3,
            high_stoch_k_advance=10,
            high_confirm_lookahead_bars=2,
            low_anchor_lookback_bars=3,
            low_stoch_k_advance=10,
            low_confirm_lookahead_bars=2,
        )

        markers = calculate_mmf_v2_state_machine_markers(features, settings)
        marker_types = {marker.type for marker in markers}

        self.assertNotIn("MMF_V2_TREND_DOWN_REBOUND", marker_types)
        self.assertNotIn("MMF_V2_TREND_UP_PULLBACK", marker_types)

    def test_tsi_crosses_are_independent_markers_with_numeric_confirm_distance(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 101, 102, 101, 100, 99, 100, 101])]
        features = pd.DataFrame(rows)
        features["tsi"] = [2.0, 3.0, 1.0, -2.0, -8.0, -4.0, 2.0, 7.0]
        features["tsiSignal"] = [1.0, 2.0, 2.0, 0.0, 0.0, -2.0, 0.0, 1.0]
        features["tsiHistogram"] = features["tsi"] - features["tsiSignal"]
        features["tsiCrossDownSignal"] = [False, False, True, False, False, False, False, False]
        features["tsiCrossUpSignal"] = [False, False, False, False, False, False, True, False]
        settings = MmfV2Settings(
            show_tsi_dead_cross_point=True,
            show_tsi_dead_cross_confirm_point=True,
            tsi_dead_cross_confirm_distance=5.0,
            show_tsi_golden_cross_point=True,
            show_tsi_golden_cross_confirm_point=True,
            tsi_golden_cross_confirm_distance=5.0,
        )

        markers = create_tsi_cross_markers(features, settings)
        by_type = {marker.type: marker for marker in markers}

        self.assertEqual(by_type["MMF_V2_TSI_DEAD_CROSS"].marker.index, 2)
        self.assertEqual(by_type["MMF_V2_TSI_DEAD_CROSS"].marker.price, features["high"].iloc[2])
        self.assertEqual(by_type["MMF_V2_TSI_DEAD_CROSS_CONFIRM"].event.index, 2)
        self.assertEqual(by_type["MMF_V2_TSI_DEAD_CROSS_CONFIRM"].marker.index, 4)
        self.assertEqual(by_type["MMF_V2_TSI_GOLDEN_CROSS"].marker.index, 6)
        self.assertEqual(by_type["MMF_V2_TSI_GOLDEN_CROSS"].marker.price, features["low"].iloc[6])
        self.assertEqual(by_type["MMF_V2_TSI_GOLDEN_CROSS_CONFIRM"].event.index, 6)
        self.assertEqual(by_type["MMF_V2_TSI_GOLDEN_CROSS_CONFIRM"].marker.index, 7)

    def test_tsi_cross_marker_requires_confirm_distance_to_be_reached(self) -> None:
        rows = [synthetic_row(index, close) for index, close in enumerate([100, 101, 102, 103, 104])]
        features = pd.DataFrame(rows)
        features["tsi"] = [2.0, 3.0, 1.0, 0.0, 1.0]
        features["tsiSignal"] = [1.0, 2.0, 2.0, 0.5, 0.8]
        features["tsiHistogram"] = features["tsi"] - features["tsiSignal"]
        features["tsiCrossDownSignal"] = [False, False, True, False, False]
        features["tsiCrossUpSignal"] = [False, False, False, False, True]
        settings = MmfV2Settings(
            show_tsi_dead_cross_point=True,
            show_tsi_dead_cross_confirm_point=True,
            tsi_dead_cross_confirm_distance=5.0,
        )

        markers = create_tsi_cross_markers(features, settings)

        self.assertEqual(markers, [])

def _attach_vdo_test_columns(features: pd.DataFrame, values: list[float]) -> None:
    vdo = pd.Series(values)
    previous = vdo.shift(1)
    features["vdo"] = vdo
    features["vdoUpLineValue"] = 0.1
    features["vdoUpLine2Value"] = 0.05
    features["vdoDownLineValue"] = -0.1
    features["vdoDownLine2Value"] = -0.05
    features["vdoCrossDownLower2"] = (previous > -0.05) & (vdo <= -0.05)
    features["vdoCrossUpLower2"] = (previous < -0.05) & (vdo >= -0.05)
    features["vdoCrossDownLower"] = (previous > -0.1) & (vdo <= -0.1)
    features["vdoCrossUpLower"] = (previous < -0.1) & (vdo >= -0.1)
    features["vdoCrossUpUpper2"] = (previous < 0.05) & (vdo >= 0.05)
    features["vdoCrossDownUpper2"] = (previous > 0.05) & (vdo <= 0.05)
    features["vdoCrossUpUpper"] = (previous < 0.1) & (vdo >= 0.1)
    features["vdoCrossDownUpper"] = (previous > 0.1) & (vdo <= 0.1)
    features["vdoBaseMa"] = 0.0
    features["vdoBase2Ma"] = 0.0
    features["vdoCrossUpBaseMa"] = (previous < 0.0) & (vdo >= 0.0)
    features["vdoCrossDownBaseMa"] = (previous > 0.0) & (vdo <= 0.0)
    features["vdoBullMarketActive"] = vdo >= 0.0
    features["vdoBearMarketActive"] = vdo <= 0.0
    features["vmiCrossDownZero"] = False
    features["vmiCrossUpZero"] = False


if __name__ == "__main__":
    unittest.main()

