import pandas as pd

from python.indicators.mmf_v3.features import apply_mmf_v3_vdo_threshold_states


def test_mmf_v3_overbought_opens_and_closes_on_inner_upper_band() -> None:
    rows = _vdo_rows([0.04, 0.06, 0.07, 0.04])

    apply_mmf_v3_vdo_threshold_states(rows)

    assert rows["vdoEnterOverbought"].tolist() == [False, True, False, False]
    assert rows["vdoExitOverbought"].tolist() == [False, False, False, True]
    assert rows["vdoOverboughtActive"].tolist() == [False, True, True, False]


def test_mmf_v3_oversold_opens_and_closes_on_inner_lower_band() -> None:
    rows = _vdo_rows([-0.04, -0.06, -0.07, -0.04])

    apply_mmf_v3_vdo_threshold_states(rows)

    assert rows["vdoEnterOversold"].tolist() == [False, True, False, False]
    assert rows["vdoExitOversold"].tolist() == [False, False, False, True]
    assert rows["vdoOversoldActive"].tolist() == [False, True, True, False]


def test_mmf_v3_overbought_does_not_reopen_before_inner_close() -> None:
    rows = _vdo_rows([0.04, 0.06, 0.07, 0.08, 0.06, 0.04, 0.06])

    apply_mmf_v3_vdo_threshold_states(rows)

    assert rows["vdoEnterOverbought"].tolist() == [False, True, False, False, False, False, True]
    assert rows["vdoExitOverbought"].tolist() == [False, False, False, False, False, True, False]
    assert _epoch_values(rows["vdoOverboughtEpoch"]) == [None, 0, 0, 0, 0, None, 1]


def test_mmf_v3_oversold_does_not_reopen_before_inner_close() -> None:
    rows = _vdo_rows([-0.04, -0.06, -0.07, -0.08, -0.06, -0.04, -0.06])

    apply_mmf_v3_vdo_threshold_states(rows)

    assert rows["vdoEnterOversold"].tolist() == [False, True, False, False, False, False, True]
    assert rows["vdoExitOversold"].tolist() == [False, False, False, False, False, True, False]
    assert _epoch_values(rows["vdoOversoldEpoch"]) == [None, 0, 0, 0, 0, None, 1]


def _vdo_rows(values: list[float]) -> pd.DataFrame:
    return pd.DataFrame({
        "vdo": values,
        "vdoDownLine2Value": [-0.05] * len(values),
        "vdoDownLineValue": [-0.1] * len(values),
        "vdoUpLine2Value": [0.05] * len(values),
        "vdoUpLineValue": [0.1] * len(values),
    })


def _epoch_values(series: pd.Series) -> list[int | None]:
    values: list[int | None] = []
    for value in series.tolist():
        values.append(None if pd.isna(value) else int(value))
    return values
