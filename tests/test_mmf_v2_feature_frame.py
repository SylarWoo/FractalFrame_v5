import pandas as pd

from python.indicators.mmf_v2.feature_frame import build_mmf_v2_feature_frame
from python.indicators.mmf_v2.models import MmfV2Settings, MmfV2TsiSettings, MmfV2VdoSettings, MmfV2VmiSettings
from python.indicators.mmf_v2.signal_decision import calculate_mmf_v2_signal_decisions


def test_mmf_v2_feature_frame_contains_unified_indicator_columns() -> None:
    frame = pd.DataFrame([_row(index, 100 + index) for index in range(160)])
    settings = MmfV2Settings(
        vdo=MmfV2VdoSettings(length=14, ema_smoothing=0),
        vmi=MmfV2VmiSettings(fast_length=5, slow_length=34),
        tsi=MmfV2TsiSettings(long_length=25, short_length=13, signal_length=13),
    )

    feature_frame = build_mmf_v2_feature_frame(frame, settings).frame

    for column in [
        "ma",
        "morgan_center",
        "stochK",
        "stochD",
        "vdo",
        "vdoOverboughtActive",
        "vdoOversoldActive",
        "vmiHistogram",
        "tsi",
        "tsiSignal",
        "tsiHistogram",
    ]:
        assert column in feature_frame.columns


def test_mmf_v2_signal_decision_frame_is_the_unified_signal_output() -> None:
    frame = pd.DataFrame([_row(index, 100 + index) for index in range(160)])
    settings = MmfV2Settings(
        show_high=True,
        show_low=True,
        show_overbought_point=True,
        show_oversold_point=True,
        vdo=MmfV2VdoSettings(length=14, ema_smoothing=0),
        vmi=MmfV2VmiSettings(fast_length=5, slow_length=34),
        tsi=MmfV2TsiSettings(long_length=25, short_length=13, signal_length=13),
    )
    feature_frame = build_mmf_v2_feature_frame(frame, settings).frame

    decision_result = calculate_mmf_v2_signal_decisions(feature_frame, settings)

    assert len(decision_result.decision_frame) == len(feature_frame)
    assert "vdo" in decision_result.decision_frame[0]
    assert "vmi" in decision_result.decision_frame[0]
    assert "stochSignals" in decision_result.decision_frame[0]
    assert "markers" in decision_result.decision_frame[0]


def _row(index: int, close: float) -> dict[str, float | int]:
    return {
        "time": 1_700_000_000 + index * 300,
        "open": close - 0.2,
        "high": close + 0.5,
        "low": close - 0.5,
        "close": close,
        "volume": 1,
    }
