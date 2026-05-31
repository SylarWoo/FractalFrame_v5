import pandas as pd

from python.indicators.vdo import VdoSettings, _attach_vdo_threshold_states, calculate_vdo_frame, calculate_vdo_values


def test_vdo_values_are_available_from_independent_python_module() -> None:
    frame = pd.DataFrame([_row(index, close) for index, close in enumerate([100, 101, 102, 101, 100, 99, 98, 99, 100, 101])])

    values = calculate_vdo_values(frame, VdoSettings(length=2, ema_smoothing=0))

    assert values.notna().sum() > 0
    assert values.index.tolist() == frame.index.tolist()


def test_vdo_frame_exposes_band_state_and_cross_flags() -> None:
    frame = pd.DataFrame([_row(index, close) for index, close in enumerate([100, 101, 102, 101, 100, 99, 98, 99, 100, 101, 102, 103])])

    rows = calculate_vdo_frame(frame, VdoSettings(length=2, ema_smoothing=0))

    assert "vdo" in rows.columns
    assert "vdoBaseMa" in rows.columns
    assert "vdoBase2Ma" in rows.columns
    assert "vdoCrossUpBaseMa" in rows.columns
    assert "vdoCrossDownBaseMa" in rows.columns
    assert "vdoZoneCode" in rows.columns
    assert "vdoCrossUpUpper2" in rows.columns
    assert "vdoCrossUpUpper3" in rows.columns
    assert "vdoCrossDownLower2" in rows.columns
    assert "vdoCrossDownLower3" in rows.columns
    assert "vdoEnterOverbought" in rows.columns
    assert "vdoExitOverbought" in rows.columns
    assert "vdoOverboughtActive" in rows.columns
    assert "vdoOverboughtEpoch" in rows.columns
    assert "vdoEnterOversold" in rows.columns
    assert "vdoExitOversold" in rows.columns
    assert "vdoOversoldActive" in rows.columns
    assert "vdoOversoldEpoch" in rows.columns
    assert "vdoUpLine3Value" in rows.columns
    assert "vdoDownLine3Value" in rows.columns
    assert 3 in set(rows["vdoZoneCode"].dropna().astype(int).tolist())
    assert -3 in set(rows["vdoZoneCode"].dropna().astype(int).tolist())
    assert int(rows["vdoCrossUpUpper2"].sum()) > 0
    assert int(rows["vdoCrossDownLower2"].sum()) > 0


def test_vdo_threshold_state_uses_outer_band_when_band_order_is_swapped() -> None:
    rows = pd.DataFrame({
        "vdo": [-0.04, -0.06, -0.08, -0.11, -0.09, -0.04, 0.04, 0.06, 0.08, 0.11, 0.09, 0.04],
        "vdoUpLineValue": [0.05] * 12,
        "vdoUpLine2Value": [0.10] * 12,
        "vdoDownLineValue": [-0.05] * 12,
        "vdoDownLine2Value": [-0.10] * 12,
        "vdoCrossUpUpper": [False, False, False, False, False, False, False, True, False, False, False, False],
        "vdoCrossDownUpper": [False] * 12,
        "vdoCrossDownLower": [False, True, False, False, False, False, False, False, False, False, False, False],
        "vdoCrossUpLower": [False] * 12,
    })

    _attach_vdo_threshold_states(rows)

    assert rows["vdoEnterOversold"].tolist() == [False, False, False, True, False, False, False, False, False, False, False, False]
    assert rows["vdoExitOversold"].tolist() == [False, False, False, False, True, False, False, False, False, False, False, False]
    assert rows["vdoEnterOverbought"].tolist() == [False, False, False, False, False, False, False, False, False, True, False, False]
    assert rows["vdoExitOverbought"].tolist() == [False, False, False, False, False, False, False, False, False, False, True, False]


def test_vdo_threshold_state_excludes_exit_bar_from_active_epoch() -> None:
    rows = pd.DataFrame({
        "vdoCrossUpUpper": [False, True, False, False],
        "vdoCrossDownUpper": [False, False, True, False],
        "vdoCrossDownLower": [False, False, False, True],
        "vdoCrossUpLower": [False, False, False, False],
    })

    _attach_vdo_threshold_states(rows)

    assert rows["vdoOverboughtActive"].tolist() == [False, True, False, False]
    assert rows["vdoOverboughtEpoch"].tolist()[1] == 0
    assert pd.isna(rows["vdoOverboughtEpoch"].tolist()[2])


def test_vdo_settings_accept_frontend_third_band_keys() -> None:
    frame = pd.DataFrame([_row(index, close) for index, close in enumerate([100, 101, 102, 101, 100, 99, 98, 99, 100, 101])])

    rows = calculate_vdo_frame(frame, {
        "length": 2,
        "emaSmoothing": 0,
        "upLine3Value": 0.2,
        "downLine3Value": -0.2,
        "vdoMaLength": 3,
        "vdoMa2Length": 4,
    })

    assert set(rows["vdoUpLine3Value"].dropna().round(6).tolist()) == {0.2}
    assert set(rows["vdoDownLine3Value"].dropna().round(6).tolist()) == {-0.2}
    assert rows["vdoBaseMa"].notna().sum() > 0
    assert rows["vdoBase2Ma"].notna().sum() > 0


def _row(index: int, close: float) -> dict[str, float | int]:
    return {
        "time": 1_700_000_000 + index * 300,
        "open": close - 0.2,
        "high": close + 0.5,
        "low": close - 0.5,
        "close": close,
    }
