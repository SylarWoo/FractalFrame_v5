import pandas as pd

from python.indicators.tsi import TsiSettings, calculate_tsi_frame


def test_tsi_frame_calculates_double_ema_momentum_and_signal() -> None:
    frame = pd.DataFrame([_row(index, close) for index, close in enumerate([1, 2, 4, 3, 6])])

    rows = calculate_tsi_frame(frame, TsiSettings(long_length=2, short_length=2, signal_length=2))

    assert pd.isna(rows["tsi"].iloc[0])
    assert rows["tsi"].iloc[1] == 100
    assert rows["tsi"].iloc[2] == 100
    assert rows["tsi"].iloc[3] == 25.00000000000001
    assert round(float(rows["tsi"].iloc[4]), 12) == round(70.24793388429751, 12)
    assert "tsiCrossUpSignal" in rows.columns
    assert "tsiCrossDownSignal" in rows.columns
    assert "tsiCrossUpZero" in rows.columns
    assert "tsiCrossDownZero" in rows.columns


def _row(index: int, close: float) -> dict[str, float | int]:
    return {
        "time": 1_700_000_000 + index * 300,
        "open": close,
        "high": close,
        "low": close,
        "close": close,
    }
