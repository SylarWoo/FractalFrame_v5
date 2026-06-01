from __future__ import annotations

from math import isfinite
from typing import Any

import pandas as pd

from python.indicators.ma import calculate_ma_frame
from python.indicators.stoch import calculate_stoch_frame
from python.indicators.tsi import calculate_tsi_frame
from python.indicators.vdo import calculate_vdo_frame, calculate_vdo_values
from python.indicators.vmi import calculate_vmi_frame
from python.indicators.vwap import calculate_vwap_frame
from python.indicators.morgan_range import (
    MORGAN_LEVEL_RATIOS,
    calculate_morgan_level_model,
    resolve_morgan_center_from_model,
    resolve_morgan_levels_from_model,
    resolve_morgan_true_range_from_model,
)
from python.market_data import normalize_ohlcv_bars


def finite_number(value: Any) -> bool:
    try:
        return isfinite(float(value))
    except (TypeError, ValueError):
        return False


def normalize_ohlcv_frame(rows: list[dict[str, Any]] | pd.DataFrame) -> pd.DataFrame:
    return normalize_ohlcv_bars(rows)


def calculate_vdo_feature(frame: pd.DataFrame, length: int = 14, ema_smoothing: int = 0) -> pd.Series:
    return calculate_vdo_values(frame, _LegacyVdoSettings(length=length, ema_smoothing=ema_smoothing))


def calculate_vdo_feature_frame(frame: pd.DataFrame, settings: Any) -> pd.DataFrame:
    vdo_features = calculate_vdo_frame(frame, settings.vdo)
    apply_mmf_v3_vdo_threshold_states(vdo_features)
    return vdo_features


def calculate_stoch_feature(frame: pd.DataFrame, length: int = 28, k_smoothing: int = 6, d_smoothing: int = 6) -> tuple[pd.Series, pd.Series]:
    stoch = calculate_stoch_frame(frame, {
        "length": length,
        "k_smoothing": k_smoothing,
        "d_smoothing": d_smoothing,
    })
    return stoch["stochK"], stoch["stochD"]


def calculate_ma_feature(frame: pd.DataFrame, length: int = 20, source: str = "close", ma_type: str = "sma") -> pd.Series:
    return calculate_ma_frame(frame, {
        "length": length,
        "ma_type": ma_type,
        "source": source,
    })["ma"]


def calculate_morgan_feature(frame: pd.DataFrame, settings: Any | None = None) -> pd.DataFrame:
    anchor = getattr(settings, "anchor", "h4")
    level_model, segment_indexes = calculate_morgan_level_model(frame, anchor)
    out = pd.DataFrame(index=frame.index)
    out["morganSegmentIndex"] = segment_indexes
    out["morgan_center"] = resolve_morgan_center_from_model(level_model)
    out["morgan_true_range"] = resolve_morgan_true_range_from_model(level_model)
    for ratio in MORGAN_LEVEL_RATIOS:
        key = f"morgan_{ratio:g}".replace("-", "neg_").replace(".", "_")
        out[key] = resolve_morgan_levels_from_model(level_model, ratio)
    return out


def build_mmf_v3_features(frame: pd.DataFrame, settings: Any) -> pd.DataFrame:
    metadata_columns = [name for name in ["barKey", "sourceIndex", "calcIndex", "time", "open", "high", "low", "close"] if name in frame.columns]
    features = frame[metadata_columns].copy()
    stoch_features = calculate_stoch_frame(frame, settings.stoch)
    vdo_features = calculate_vdo_feature_frame(frame, settings)
    ma_features = calculate_ma_frame(frame, settings.ma)
    vmi_settings = getattr(settings, "vmi", None)
    vmi_features = calculate_vmi_frame(frame, {
        "fast_length": getattr(vmi_settings, "fast_length", 5),
        "slow_length": getattr(vmi_settings, "slow_length", 34),
        "vdo": getattr(settings, "vdo", None),
        "vdo_values": vdo_features["vdo"],
    })
    tsi_features = calculate_tsi_frame(frame, getattr(settings, "tsi", None))
    vwap_features = calculate_vwap_frame(frame, getattr(settings, "vwap", None))
    return pd.concat([features, stoch_features, vdo_features, vmi_features, tsi_features, ma_features, vwap_features, calculate_morgan_feature(frame, settings.morgan)], axis=1)


def apply_mmf_v3_vdo_threshold_states(out: pd.DataFrame) -> None:
    """Use inner VDO bands to enter and close MMF_V3 zones."""
    if "vdo" not in out.columns:
        return

    vdo = pd.to_numeric(out["vdo"], errors="coerce")
    previous = vdo.shift(1)
    upper_entry = _vdo_threshold(out, "vdoUpLineValue", "vdoUpLine2Value", "inner_upper")
    upper_exit = _vdo_threshold(out, "vdoUpLineValue", "vdoUpLine2Value", "inner_upper")
    lower_entry = _vdo_threshold(out, "vdoDownLineValue", "vdoDownLine2Value", "inner_lower")
    lower_exit = _vdo_threshold(out, "vdoDownLineValue", "vdoDownLine2Value", "inner_lower")

    enter_overbought = ((previous < upper_entry.shift(1)) & (vdo >= upper_entry)).fillna(False)
    exit_overbought = ((previous > upper_exit.shift(1)) & (vdo <= upper_exit)).fillna(False)
    enter_oversold = ((previous > lower_entry.shift(1)) & (vdo <= lower_entry)).fillna(False)
    exit_oversold = ((previous < lower_exit.shift(1)) & (vdo >= lower_exit)).fillna(False)

    _write_vdo_threshold_state_columns(
        out,
        enter_overbought=enter_overbought,
        exit_overbought=exit_overbought,
        enter_oversold=enter_oversold,
        exit_oversold=exit_oversold,
    )


def _vdo_threshold(out: pd.DataFrame, primary_column: str, secondary_column: str, mode: str) -> pd.Series:
    if primary_column not in out.columns:
        return pd.Series(float("nan"), index=out.index)
    primary = pd.to_numeric(out[primary_column], errors="coerce")
    if secondary_column not in out.columns:
        return primary
    secondary = pd.to_numeric(out[secondary_column], errors="coerce")
    values = pd.concat([primary, secondary], axis=1)
    if mode == "outer_upper":
        return values.max(axis=1)
    if mode == "inner_upper":
        return values.min(axis=1)
    if mode == "outer_lower":
        return values.min(axis=1)
    return values.max(axis=1)


def _write_vdo_threshold_state_columns(
    out: pd.DataFrame,
    *,
    enter_overbought: pd.Series,
    exit_overbought: pd.Series,
    enter_oversold: pd.Series,
    exit_oversold: pd.Series,
) -> None:
    normalized_enter_overbought: list[bool] = []
    normalized_exit_overbought: list[bool] = []
    normalized_enter_oversold: list[bool] = []
    normalized_exit_oversold: list[bool] = []
    overbought_active: list[bool] = []
    oversold_active: list[bool] = []
    overbought_epochs: list[int | None] = []
    oversold_epochs: list[int | None] = []
    overbought_epoch = -1
    oversold_epoch = -1
    is_overbought = False
    is_oversold = False

    for index in range(len(out)):
        enters_overbought = bool(enter_overbought.iloc[index]) and not is_overbought
        exits_overbought = bool(exit_overbought.iloc[index]) and is_overbought
        enters_oversold = bool(enter_oversold.iloc[index]) and not is_oversold
        exits_oversold = bool(exit_oversold.iloc[index]) and is_oversold

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

        normalized_enter_overbought.append(enters_overbought)
        normalized_exit_overbought.append(exits_overbought)
        normalized_enter_oversold.append(enters_oversold)
        normalized_exit_oversold.append(exits_oversold)
        overbought_active.append(is_overbought)
        oversold_active.append(is_oversold)
        overbought_epochs.append(overbought_epoch if is_overbought else None)
        oversold_epochs.append(oversold_epoch if is_oversold else None)

    out["vdoEnterOverbought"] = normalized_enter_overbought
    out["vdoExitOverbought"] = normalized_exit_overbought
    out["vdoOverboughtActive"] = overbought_active
    out["vdoOverboughtEpoch"] = overbought_epochs
    out["vdoEnterOversold"] = normalized_enter_oversold
    out["vdoExitOversold"] = normalized_exit_oversold
    out["vdoOversoldActive"] = oversold_active
    out["vdoOversoldEpoch"] = oversold_epochs


class _LegacyVdoSettings:
    def __init__(self, length: int = 14, ema_smoothing: int = 0) -> None:
        self.length = length
        self.ema_smoothing = ema_smoothing
