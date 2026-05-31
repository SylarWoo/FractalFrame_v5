from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd


@dataclass(frozen=True)
class VdoSettings:
    length: int = 14
    ema_smoothing: int = 0
    zero_line_value: float = 0.0
    up_line_value: float = 0.1
    up_line2_value: float = 0.05
    up_line3_value: float = 0.16
    down_line_value: float = -0.1
    down_line2_value: float = -0.05
    down_line3_value: float = -0.16
    vdo_base_ma_length: int = 14
    vdo_base2_ma_length: int = 34


def normalize_vdo_settings(settings: Any | None = None) -> VdoSettings:
    source = settings or VdoSettings()
    return VdoSettings(
        length=_safe_int(_read_setting(source, "length", "length", 14), 14, minimum=1),
        ema_smoothing=_safe_int(_read_setting(source, "ema_smoothing", "emaSmoothing", 0), 0, minimum=0),
        zero_line_value=_safe_float(_read_setting(source, "zero_line_value", "zeroLineValue", 0.0), 0.0),
        up_line_value=_safe_float(_read_setting(source, "up_line_value", "upLineValue", 0.1), 0.1),
        up_line2_value=_safe_float(_read_setting(source, "up_line2_value", "upLine2Value", 0.05), 0.05),
        up_line3_value=_safe_float(_read_setting(source, "up_line3_value", "upLine3Value", 0.16), 0.16),
        down_line_value=_safe_float(_read_setting(source, "down_line_value", "downLineValue", -0.1), -0.1),
        down_line2_value=_safe_float(_read_setting(source, "down_line2_value", "downLine2Value", -0.05), -0.05),
        down_line3_value=_safe_float(_read_setting(source, "down_line3_value", "downLine3Value", -0.16), -0.16),
        vdo_base_ma_length=_safe_int(_read_setting(source, "vdo_base_ma_length", "vdoMaLength", 14), 14, minimum=1),
        vdo_base2_ma_length=_safe_int(_read_setting(source, "vdo_base2_ma_length", "vdoMa2Length", 34), 34, minimum=1),
    )


def calculate_vdo_values(frame: pd.DataFrame, settings: Any | None = None) -> pd.Series:
    active_settings = normalize_vdo_settings(settings)
    previous_close = frame["close"].shift(1)
    true_range = pd.concat([
        frame["high"] - frame["low"],
        (frame["high"] - previous_close).abs(),
        (frame["low"] - previous_close).abs(),
    ], axis=1).max(axis=1)
    plus_vm = (frame["high"] - frame["low"].shift(1)).abs()
    minus_vm = (frame["low"] - frame["high"].shift(1)).abs()
    tr_sum = true_range.rolling(window=active_settings.length, min_periods=active_settings.length).sum()
    plus_vi = plus_vm.rolling(window=active_settings.length, min_periods=active_settings.length).sum() / tr_sum
    minus_vi = minus_vm.rolling(window=active_settings.length, min_periods=active_settings.length).sum() / tr_sum
    vdo = plus_vi - minus_vi
    if active_settings.ema_smoothing > 1:
        return vdo.ewm(span=active_settings.ema_smoothing, adjust=False, min_periods=active_settings.ema_smoothing).mean()
    return vdo


def calculate_vdo_frame(frame: pd.DataFrame, settings: Any | None = None) -> pd.DataFrame:
    active_settings = normalize_vdo_settings(settings)
    vdo = calculate_vdo_values(frame, active_settings)
    previous = vdo.shift(1)
    out = pd.DataFrame(index=frame.index)
    out["vdo"] = vdo
    out["vdoBaseMa"] = vdo.rolling(window=active_settings.vdo_base_ma_length, min_periods=active_settings.vdo_base_ma_length).mean()
    out["vdoBase2Ma"] = vdo.rolling(window=active_settings.vdo_base2_ma_length, min_periods=active_settings.vdo_base2_ma_length).mean()
    previous_base_ma = out["vdoBaseMa"].shift(1)
    out["vdoDelta"] = vdo.diff()
    out["vdoDirection"] = (out["vdoDelta"] > 0).astype("int8") - (out["vdoDelta"] < 0).astype("int8")
    out["vdoZeroLineValue"] = active_settings.zero_line_value
    out["vdoUpLineValue"] = active_settings.up_line_value
    out["vdoUpLine2Value"] = active_settings.up_line2_value
    out["vdoUpLine3Value"] = active_settings.up_line3_value
    out["vdoDownLineValue"] = active_settings.down_line_value
    out["vdoDownLine2Value"] = active_settings.down_line2_value
    out["vdoDownLine3Value"] = active_settings.down_line3_value
    out["vdoZoneCode"] = 0
    out.loc[vdo > active_settings.up_line_value, "vdoZoneCode"] = 3
    out.loc[(vdo >= active_settings.up_line2_value) & (vdo <= active_settings.up_line_value), "vdoZoneCode"] = 2
    out.loc[(vdo >= active_settings.down_line2_value) & (vdo <= active_settings.up_line2_value), "vdoZoneCode"] = 1
    out.loc[(vdo >= active_settings.down_line_value) & (vdo <= active_settings.down_line2_value), "vdoZoneCode"] = -2
    out.loc[vdo < active_settings.down_line_value, "vdoZoneCode"] = -3
    out["vdoCrossUpZero"] = (previous < active_settings.zero_line_value) & (vdo >= active_settings.zero_line_value)
    out["vdoCrossDownZero"] = (previous > active_settings.zero_line_value) & (vdo <= active_settings.zero_line_value)
    out["vdoCrossUpUpper2"] = (previous < active_settings.up_line2_value) & (vdo >= active_settings.up_line2_value)
    out["vdoCrossDownUpper2"] = (previous > active_settings.up_line2_value) & (vdo <= active_settings.up_line2_value)
    out["vdoCrossUpUpper"] = (previous < active_settings.up_line_value) & (vdo >= active_settings.up_line_value)
    out["vdoCrossDownUpper"] = (previous > active_settings.up_line_value) & (vdo <= active_settings.up_line_value)
    out["vdoCrossUpUpper3"] = (previous < active_settings.up_line3_value) & (vdo >= active_settings.up_line3_value)
    out["vdoCrossDownUpper3"] = (previous > active_settings.up_line3_value) & (vdo <= active_settings.up_line3_value)
    out["vdoCrossDownLower2"] = (previous > active_settings.down_line2_value) & (vdo <= active_settings.down_line2_value)
    out["vdoCrossUpLower2"] = (previous < active_settings.down_line2_value) & (vdo >= active_settings.down_line2_value)
    out["vdoCrossDownLower"] = (previous > active_settings.down_line_value) & (vdo <= active_settings.down_line_value)
    out["vdoCrossUpLower"] = (previous < active_settings.down_line_value) & (vdo >= active_settings.down_line_value)
    out["vdoCrossDownLower3"] = (previous > active_settings.down_line3_value) & (vdo <= active_settings.down_line3_value)
    out["vdoCrossUpLower3"] = (previous < active_settings.down_line3_value) & (vdo >= active_settings.down_line3_value)
    out["vdoCrossUpBaseMa"] = (previous < previous_base_ma) & (vdo >= out["vdoBaseMa"])
    out["vdoCrossDownBaseMa"] = (previous > previous_base_ma) & (vdo <= out["vdoBaseMa"])
    _attach_vdo_market_states(out)
    _attach_vdo_threshold_states(out)
    return out


def _attach_vdo_market_states(out: pd.DataFrame) -> None:
    bull_active: list[bool] = []
    bear_active: list[bool] = []
    state: str | None = None

    for index in range(len(out)):
        if bool(out["vdoCrossUpBaseMa"].iloc[index]):
            state = "bull"
        elif bool(out["vdoCrossDownBaseMa"].iloc[index]):
            state = "bear"
        elif state is None:
            vdo = pd.to_numeric(out["vdo"].iloc[index], errors="coerce")
            ma = pd.to_numeric(out["vdoBaseMa"].iloc[index], errors="coerce")
            if pd.notna(vdo) and pd.notna(ma):
                state = "bull" if float(vdo) >= float(ma) else "bear"

        bull_active.append(state == "bull")
        bear_active.append(state == "bear")

    out["vdoBullMarketActive"] = bull_active
    out["vdoBearMarketActive"] = bear_active


def _attach_vdo_threshold_states(out: pd.DataFrame) -> None:
    enter_overbought, exit_overbought, enter_oversold, exit_oversold = _resolve_outer_threshold_crosses(out)
    overbought_active: list[bool] = []
    oversold_active: list[bool] = []
    overbought_epochs: list[int | None] = []
    oversold_epochs: list[int | None] = []
    overbought_epoch = -1
    oversold_epoch = -1
    is_overbought = False
    is_oversold = False

    for index in range(len(out)):
        enters_overbought = bool(enter_overbought.iloc[index])
        exits_overbought = bool(exit_overbought.iloc[index])
        enters_oversold = bool(enter_oversold.iloc[index])
        exits_oversold = bool(exit_oversold.iloc[index])

        if exits_overbought:
            is_overbought = False
        if exits_oversold:
            is_oversold = False

        if enters_overbought:
            overbought_epoch += 1
            is_overbought = True
        if enters_oversold:
            oversold_epoch += 1
            is_oversold = True

        overbought_active.append(is_overbought)
        oversold_active.append(is_oversold)
        overbought_epochs.append(overbought_epoch if is_overbought else None)
        oversold_epochs.append(oversold_epoch if is_oversold else None)

    out["vdoEnterOverbought"] = enter_overbought
    out["vdoExitOverbought"] = exit_overbought
    out["vdoOverboughtActive"] = overbought_active
    out["vdoOverboughtEpoch"] = overbought_epochs
    out["vdoEnterOversold"] = enter_oversold
    out["vdoExitOversold"] = exit_oversold
    out["vdoOversoldActive"] = oversold_active
    out["vdoOversoldEpoch"] = oversold_epochs


def _resolve_outer_threshold_crosses(out: pd.DataFrame) -> tuple[pd.Series, pd.Series, pd.Series, pd.Series]:
    if {"vdo", "vdoUpLineValue", "vdoDownLineValue"}.issubset(out.columns):
        vdo = out["vdo"]
        previous = vdo.shift(1)
        upper = _outer_threshold_series(out, "vdoUpLineValue", "vdoUpLine2Value", "upper")
        lower = _outer_threshold_series(out, "vdoDownLineValue", "vdoDownLine2Value", "lower")
        previous_upper = upper.shift(1)
        previous_lower = lower.shift(1)
        enter_overbought = (previous < previous_upper) & (vdo >= upper)
        exit_overbought = (previous > previous_upper) & (vdo <= upper)
        enter_oversold = (previous > previous_lower) & (vdo <= lower)
        exit_oversold = (previous < previous_lower) & (vdo >= lower)
        return (
            enter_overbought.fillna(False),
            exit_overbought.fillna(False),
            enter_oversold.fillna(False),
            exit_oversold.fillna(False),
        )

    return (
        out.get("vdoCrossUpUpper", pd.Series(False, index=out.index)).fillna(False),
        out.get("vdoCrossDownUpper", pd.Series(False, index=out.index)).fillna(False),
        out.get("vdoCrossDownLower", pd.Series(False, index=out.index)).fillna(False),
        out.get("vdoCrossUpLower", pd.Series(False, index=out.index)).fillna(False),
    )


def _outer_threshold_series(out: pd.DataFrame, primary_column: str, secondary_column: str, side: str) -> pd.Series:
    primary = pd.to_numeric(out[primary_column], errors="coerce")
    if secondary_column not in out.columns:
        return primary
    secondary = pd.to_numeric(out[secondary_column], errors="coerce")
    values = pd.concat([primary, secondary], axis=1)
    return values.max(axis=1) if side == "upper" else values.min(axis=1)


def _safe_float(value: Any, fallback: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    return number if number == number else fallback


def _read_setting(source: Any, snake_key: str, camel_key: str, fallback: Any) -> Any:
    if isinstance(source, dict):
        return source.get(snake_key, source.get(camel_key, fallback))
    if hasattr(source, snake_key):
        return getattr(source, snake_key)
    return getattr(source, camel_key, fallback)


def _safe_int(value: Any, fallback: int, minimum: int = 0) -> int:
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError):
        return fallback
    return max(minimum, number)
