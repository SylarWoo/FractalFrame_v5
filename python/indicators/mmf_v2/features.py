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
    return calculate_vdo_frame(frame, settings.vdo)


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


def build_mmf_v2_features(frame: pd.DataFrame, settings: Any) -> pd.DataFrame:
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


class _LegacyVdoSettings:
    def __init__(self, length: int = 14, ema_smoothing: int = 0) -> None:
        self.length = length
        self.ema_smoothing = ema_smoothing
