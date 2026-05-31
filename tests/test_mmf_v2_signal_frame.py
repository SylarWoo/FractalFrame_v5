import pandas as pd

from python.indicators.mmf_v2.models import create_mmf_v2_marker
from python.indicators.mmf_v2.signal_frame import build_mmf_v2_signal_frame


def test_signal_frame_exposes_bar_indicators_signals_and_point_momentum() -> None:
    features = _features([0.01, 0.02, 0.04, 0.08, 0.09])
    marker = _marker("MMF_V2_LOW", marker_index=1, entry_index=3, price=99, entry_price=101)

    rows = build_mmf_v2_signal_frame(features, [marker], period_seconds=300)

    assert len(rows) == 5
    assert rows[1]["barKey"] == "bar-1"
    assert rows[1]["stoch"]["k"] == 51
    assert rows[1]["vdo"]["value"] == 0.02
    assert rows[1]["ma"]["value"] == 101
    assert rows[1]["morgan"]["trueRange"] == 30
    assert rows[1]["morgan"]["positionRatio"] == 0
    assert rows[1]["signalFlags"]["MMF_V2_LOW"] is True
    assert rows[1]["signals"][0]["type"] == "MMF_V2_LOW"
    assert rows[1]["signals"][0]["momentum"]["kind"] == "high_low"
    assert rows[1]["signals"][0]["momentum"]["direction"] == "up"
    assert round(rows[1]["signals"][0]["momentum"]["value"], 2) == 100


def test_signal_frame_exposes_breakout_momentum_from_previous_structure_point() -> None:
    features = _features([0.01, 0.02, 0.03, 0.05, 0.11])
    low = _marker("MMF_V2_SUPPORT", marker_index=1, entry_index=2, price=99, entry_price=100)
    breakout = _marker("MMF_V2_RESISTANCE_UP_BREAK", marker_index=4, entry_index=4, price=104, entry_price=104)

    rows = build_mmf_v2_signal_frame(features, [low, breakout], period_seconds=300)

    signal = rows[4]["signals"][0]
    assert signal["momentum"]["kind"] == "breakout"
    assert signal["momentum"]["direction"] == "up"
    assert signal["momentum"]["previousType"] == "MMF_V2_SUPPORT"
    assert signal["momentum"]["bars"] == 3
    assert round(signal["momentum"]["value"], 2) == 100


def _features(vdo_values: list[float]) -> pd.DataFrame:
    rows = []
    for index, vdo in enumerate(vdo_values):
        close = 100 + index
        rows.append({
            "barKey": f"bar-{index}",
            "sourceIndex": index,
            "time": 1_700_000_000 + index * 300,
            "open": close - 0.2,
            "high": close + 0.5,
            "low": close - 0.5,
            "close": close,
            "stochK": 50 + index,
            "stochD": 45 + index,
            "vdo": vdo,
            "vdoDelta": 0 if index == 0 else vdo - vdo_values[index - 1],
            "vdoDirection": 1,
            "vdoZoneCode": 1,
            "ma": close,
            "morganSegmentIndex": 0,
            "morgan_center": close,
            "morgan_true_range": 30,
            "morgan_neg_0_236": close - 7.08,
            "morgan_neg_0_118": close - 3.54,
            "morgan_0_118": close + 3.54,
            "morgan_0_236": close + 7.08,
        })
    return pd.DataFrame(rows)


def _marker(marker_type: str, marker_index: int, entry_index: int, price: float, entry_price: float):
    return create_mmf_v2_marker(
        type=marker_type,  # type: ignore[arg-type]
        event_index=marker_index,
        event_bar_key=f"bar-{marker_index}",
        event_time=1_700_000_000 + marker_index * 300,
        confirm_index=entry_index,
        confirm_bar_key=f"bar-{entry_index}",
        confirm_time=1_700_000_000 + entry_index * 300,
        marker_index=marker_index,
        marker_bar_key=f"bar-{marker_index}",
        marker_time=1_700_000_000 + marker_index * 300,
        marker_price=price,
        entry_index=entry_index,
        entry_bar_key=f"bar-{entry_index}",
        entry_time=1_700_000_000 + entry_index * 300,
        entry_price=entry_price,
        point_distance=abs(entry_price - price),
        window_start_index=marker_index,
        window_start_bar_key=f"bar-{marker_index}",
        window_start_time=1_700_000_000 + marker_index * 300,
        window_end_index=entry_index,
        window_end_bar_key=f"bar-{entry_index}",
        window_end_time=1_700_000_000 + entry_index * 300,
        reason=("test",),
    )
