from __future__ import annotations

import pandas as pd

from python.indicators.mmf_indicator import MmfSettings, calculate_mmf_high_markers


def row(index: int, close: float) -> dict:
    return {
        "time": 1_700_000_000 + index * 300,
        "open": close,
        "high": close + 0.5,
        "low": close - 0.5,
        "close": close,
        "volume": 1,
    }


def install_mocks(monkeypatch, data: pd.DataFrame, dpo: list[float], k: list[float], d: list[float]) -> None:
    import python.indicators.mmf_indicator as mmf

    monkeypatch.setattr(mmf, "calculate_dpo", lambda close, length=21: pd.Series(dpo, index=data.index))
    monkeypatch.setattr(
        mmf,
        "calculate_stoch",
        lambda frame, length=14, k_smoothing=3, d_smoothing=3: (
            pd.Series(k, index=data.index),
            pd.Series(d, index=data.index),
        ),
    )
    monkeypatch.setattr(
        mmf,
        "calculate_morgan_level_model",
        lambda frame: (pd.Series([None] * len(frame), index=data.index), pd.Series([None] * len(frame), index=data.index)),
    )


def test_mmf_high_uses_stoch_cycle_and_filters_by_dpo(monkeypatch):
    data = pd.DataFrame([row(index, close) for index, close in enumerate([100, 102, 108, 104, 112, 109, 106, 103])])
    install_mocks(
        monkeypatch,
        data,
        dpo=[0, 0, 8, 12, 13, 12, 9, 6],
        k=[42, 48, 55, 72, 86, 76, 68, 66],
        d=[44, 49, 52, 70, 82, 78, 69, 66],
    )

    payload = calculate_mmf_high_markers(data, MmfSettings(dpo_value=11, show_low=False))

    assert payload["markersCount"] == 1
    assert payload["markers"][0]["type"] == "MMF_HIGH"
    assert payload["markers"][0]["index"] == 4
    assert payload["markers"][0]["price"] == 112.5
    assert payload["markers"][0]["confirmThreshold"] == 70


def test_mmf_high_does_not_mark_without_price_or_dpo_filter_inside_cycle(monkeypatch):
    data = pd.DataFrame([row(index, close) for index, close in enumerate([100, 102, 108, 104, 112, 109, 106, 103])])
    install_mocks(
        monkeypatch,
        data,
        dpo=[0, 0, 8, 9, 10, 9, 8, 6],
        k=[42, 48, 55, 72, 86, 76, 68, 66],
        d=[44, 49, 52, 70, 82, 78, 69, 66],
    )

    payload = calculate_mmf_high_markers(data, MmfSettings(dpo_value=11, show_low=False))

    assert payload["markersCount"] == 0


def test_mmf_high_rejects_cycle_when_stoch_top_stays_inside_70(monkeypatch):
    data = pd.DataFrame([row(index, close) for index, close in enumerate([100, 102, 108, 104, 112, 109, 106, 103])])
    install_mocks(
        monkeypatch,
        data,
        dpo=[0, 0, 8, 12, 13, 12, 9, 6],
        k=[42, 48, 55, 66, 69, 64, 60, 58],
        d=[44, 49, 52, 65, 67, 66, 61, 58],
    )

    payload = calculate_mmf_high_markers(data, MmfSettings(dpo_value=11, show_low=False))

    assert payload["markersCount"] == 0


def test_mmf_high_rejects_dead_cross_when_golden_cross_appears_in_next_7_bars(monkeypatch):
    data = pd.DataFrame([row(index, close) for index, close in enumerate([100, 102, 108, 104, 112, 109, 106, 103, 101])])
    install_mocks(
        monkeypatch,
        data,
        dpo=[0, 0, 8, 12, 13, 12, 9, 6, 4],
        k=[42, 48, 80, 70, 64, 72, 68, 66, 64],
        d=[44, 49, 75, 72, 70, 68, 69, 66, 64],
    )

    payload = calculate_mmf_high_markers(data, MmfSettings(dpo_value=11, show_low=False))

    assert payload["markersCount"] == 0


def test_mmf_low_uses_stoch_cycle_and_filters_by_dpo(monkeypatch):
    data = pd.DataFrame([row(index, close) for index, close in enumerate([100, 99, 96, 94, 92, 91, 93, 95])])
    install_mocks(
        monkeypatch,
        data,
        dpo=[0, 0, -8, -12, -13, -12, -8, -6],
        k=[58, 52, 45, 28, 16, 24, 32, 34],
        d=[56, 51, 48, 30, 20, 22, 31, 33],
    )

    payload = calculate_mmf_high_markers(data, MmfSettings(show_high=False, show_low=True, low_dpo_value=-11))

    assert payload["markersCount"] == 1
    assert payload["markers"][0]["type"] == "MMF_LOW"
    assert payload["markers"][0]["index"] == 5
    assert payload["markers"][0]["price"] == 90.5
    assert payload["markers"][0]["confirmThreshold"] == 30


def test_mmf_low_does_not_mark_without_price_or_dpo_filter_inside_cycle(monkeypatch):
    data = pd.DataFrame([row(index, close) for index, close in enumerate([100, 99, 96, 94, 92, 91, 93, 95])])
    install_mocks(
        monkeypatch,
        data,
        dpo=[0, 0, -8, -9, -10, -9, -8, -6],
        k=[58, 52, 45, 28, 16, 24, 32, 34],
        d=[56, 51, 48, 30, 20, 22, 31, 33],
    )

    payload = calculate_mmf_high_markers(data, MmfSettings(show_high=False, show_low=True, low_dpo_value=-11))

    assert payload["markersCount"] == 0


def test_mmf_low_rejects_golden_cross_when_dead_cross_appears_in_next_7_bars(monkeypatch):
    data = pd.DataFrame([row(index, close) for index, close in enumerate([100, 99, 96, 94, 92, 91, 93, 95, 96])])
    install_mocks(
        monkeypatch,
        data,
        dpo=[0, 0, -8, -12, -13, -12, -8, -6, -4],
        k=[58, 52, 20, 32, 36, 30, 32, 34, 35],
        d=[56, 51, 25, 30, 32, 34, 31, 33, 34],
    )

    payload = calculate_mmf_high_markers(data, MmfSettings(show_high=False, show_low=True, low_dpo_value=-11))

    assert payload["markersCount"] == 0


def test_mmf_low_rejects_cycle_when_stoch_bottom_stays_inside_30(monkeypatch):
    data = pd.DataFrame([row(index, close) for index, close in enumerate([100, 99, 96, 94, 92, 91, 93, 95])])
    install_mocks(
        monkeypatch,
        data,
        dpo=[0, 0, -8, -12, -13, -12, -8, -6],
        k=[58, 52, 45, 34, 31, 36, 42, 44],
        d=[56, 51, 48, 35, 33, 34, 41, 43],
    )

    payload = calculate_mmf_high_markers(data, MmfSettings(show_high=False, show_low=True, low_dpo_value=-11))

    assert payload["markersCount"] == 0
