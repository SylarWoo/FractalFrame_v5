import pandas as pd

from python.indicators.mmf_v3.models import MmfV3Settings
from python.indicators.mmf_v3.strategy_bpr import create_bpr_m5_strategy_markers


def test_bpr_long_entry_and_exit_follow_pullback_then_tsi_confirm() -> None:
    features = _base_features(8)
    features.loc[1, "vdoEnterOverbought"] = True
    features.loc[1:4, "vdoBullMarketActive"] = True
    features.loc[2, "vmiHistogram"] = -0.1
    features.loc[3, "tsiCrossUpSignal"] = True
    features.loc[3, "tsiHistogram"] = 6
    features.loc[5, "tsiCrossDownSignal"] = True
    features.loc[5, "tsiHistogram"] = -6

    markers = create_bpr_m5_strategy_markers(features, MmfV3Settings(show_bpr_m5_strategy=True))

    assert [marker.type for marker in markers] == ["MMF_V3_BPR_LONG_ENTRY", "MMF_V3_BPR_LONG_EXIT"]
    assert markers[0].marker.index == 3
    assert markers[0].marker.price == features.loc[3, "low"]
    assert markers[1].marker.index == 5
    assert markers[1].marker.price == features.loc[5, "high"]


def test_bpr_long_stop_loss_marks_stop_bar_below_candle() -> None:
    features = _base_features(6)
    features.loc[1, "vdoEnterOverbought"] = True
    features.loc[1:4, "vdoBullMarketActive"] = True
    features.loc[2, "vmiHistogram"] = -0.1
    features.loc[3, "tsiCrossUpSignal"] = True
    features.loc[3, "tsiHistogram"] = 6
    features.loc[3, "morgan_neg_0_236"] = 97
    features.loc[4, "low"] = 96.5

    markers = create_bpr_m5_strategy_markers(features, MmfV3Settings(show_bpr_m5_strategy=True))

    assert [marker.type for marker in markers] == ["MMF_V3_BPR_LONG_ENTRY", "MMF_V3_BPR_LONG_STOP_LOSS"]
    assert markers[1].marker.index == 4
    assert markers[1].marker.price == features.loc[4, "low"]


def _base_features(count: int) -> pd.DataFrame:
    return pd.DataFrame({
        "barKey": [f"bar:{index}" for index in range(count)],
        "time": [index * 60 for index in range(count)],
        "high": [101.0 + index for index in range(count)],
        "low": [99.0 + index for index in range(count)],
        "vmiHistogram": [0.0] * count,
        "vdoBullMarketActive": [False] * count,
        "vdoBearMarketActive": [False] * count,
        "vdoEnterOverbought": [False] * count,
        "vdoEnterOversold": [False] * count,
        "tsiCrossDownSignal": [False] * count,
        "tsiCrossUpSignal": [False] * count,
        "tsiHistogram": [0.0] * count,
        "morgan_neg_0_236": [97.0] * count,
        "morgan_0_236": [103.0] * count,
    })
