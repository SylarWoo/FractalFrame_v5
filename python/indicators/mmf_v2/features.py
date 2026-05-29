from __future__ import annotations

from math import floor, isfinite
from typing import Any

import pandas as pd

from python.market_data import normalize_ohlcv_bars

H4_MORGAN_SECONDS = 4 * 60 * 60
XAU_SESSION_ANCHOR_SECONDS = 22 * 60 * 60
MORGAN_LEVEL_RATIOS = (-1, -0.786, -0.618, -0.5, -0.382, -0.236, -0.177, -0.118, -0.059, 0, 0.059, 0.118, 0.177, 0.236, 0.382, 0.5, 0.618, 0.786, 1)


def finite_number(value: Any) -> bool:
    try:
        return isfinite(float(value))
    except (TypeError, ValueError):
        return False


def normalize_ohlcv_frame(rows: list[dict[str, Any]] | pd.DataFrame) -> pd.DataFrame:
    return normalize_ohlcv_bars(rows)


def calculate_stoch_feature(frame: pd.DataFrame, length: int = 28, k_smoothing: int = 6, d_smoothing: int = 6) -> tuple[pd.Series, pd.Series]:
    safe_length = max(1, int(length or 28))
    safe_k = max(1, int(k_smoothing or 6))
    safe_d = max(1, int(d_smoothing or 6))
    highest_high = frame["high"].rolling(window=safe_length, min_periods=safe_length).max()
    lowest_low = frame["low"].rolling(window=safe_length, min_periods=safe_length).min()
    price_range = highest_high - lowest_low
    raw_k = ((frame["close"] - lowest_low) / price_range) * 100
    raw_k = raw_k.where(price_range != 0)
    k = raw_k.rolling(window=safe_k, min_periods=safe_k).mean()
    d = k.rolling(window=safe_d, min_periods=safe_d).mean()
    return k, d


def calculate_ma_feature(frame: pd.DataFrame, length: int = 20, source: str = "close", ma_type: str = "sma") -> pd.Series:
    safe_length = max(1, int(length or 20))
    values = _source_series(frame, source)
    if ma_type.lower() == "ema":
        return values.ewm(span=safe_length, adjust=False, min_periods=safe_length).mean()
    return values.rolling(window=safe_length, min_periods=safe_length).mean()


def calculate_vdo_feature(frame: pd.DataFrame, length: int = 14, ema_smoothing: int = 0) -> pd.Series:
    safe_length = max(1, int(length or 14))
    previous_close = frame["close"].shift(1)
    true_range = pd.concat([
        frame["high"] - frame["low"],
        (frame["high"] - previous_close).abs(),
        (frame["low"] - previous_close).abs(),
    ], axis=1).max(axis=1)
    plus_vm = (frame["high"] - frame["low"].shift(1)).abs()
    minus_vm = (frame["low"] - frame["high"].shift(1)).abs()
    tr_sum = true_range.rolling(window=safe_length, min_periods=safe_length).sum()
    plus_vi = plus_vm.rolling(window=safe_length, min_periods=safe_length).sum() / tr_sum
    minus_vi = minus_vm.rolling(window=safe_length, min_periods=safe_length).sum() / tr_sum
    vdo = plus_vi - minus_vi
    safe_ema = max(0, int(ema_smoothing or 0))
    if safe_ema > 1:
        return vdo.ewm(span=safe_ema, adjust=False, min_periods=safe_ema).mean()
    return vdo


def calculate_vdo_feature_frame(frame: pd.DataFrame, settings: Any) -> pd.DataFrame:
    vdo = calculate_vdo_feature(frame, settings.vdo.length, settings.vdo.ema_smoothing)
    zero = float(getattr(settings.vdo, "zero_line_value", 0.0))
    upper = float(getattr(settings.vdo, "up_line_value", 0.1))
    upper2 = float(getattr(settings.vdo, "up_line2_value", 0.05))
    lower = float(getattr(settings.vdo, "down_line_value", -0.1))
    lower2 = float(getattr(settings.vdo, "down_line2_value", -0.05))
    previous = vdo.shift(1)
    out = pd.DataFrame(index=frame.index)
    out["vdo"] = vdo
    out["vdoDelta"] = vdo.diff()
    out["vdoDirection"] = (out["vdoDelta"] > 0).astype("int8") - (out["vdoDelta"] < 0).astype("int8")
    out["vdoZeroLineValue"] = zero
    out["vdoUpLineValue"] = upper
    out["vdoUpLine2Value"] = upper2
    out["vdoDownLineValue"] = lower
    out["vdoDownLine2Value"] = lower2
    out["vdoZoneCode"] = 0
    out.loc[vdo > upper, "vdoZoneCode"] = 3
    out.loc[(vdo >= upper2) & (vdo <= upper), "vdoZoneCode"] = 2
    out.loc[(vdo >= lower2) & (vdo <= upper2), "vdoZoneCode"] = 1
    out.loc[(vdo >= lower) & (vdo <= lower2), "vdoZoneCode"] = -2
    out.loc[vdo < lower, "vdoZoneCode"] = -3
    out["vdoCrossUpZero"] = (previous < zero) & (vdo >= zero)
    out["vdoCrossDownZero"] = (previous > zero) & (vdo <= zero)
    out["vdoCrossUpUpper2"] = (previous < upper2) & (vdo >= upper2)
    out["vdoCrossDownUpper2"] = (previous > upper2) & (vdo <= upper2)
    out["vdoCrossUpUpper"] = (previous < upper) & (vdo >= upper)
    out["vdoCrossDownUpper"] = (previous > upper) & (vdo <= upper)
    out["vdoCrossDownLower2"] = (previous > lower2) & (vdo <= lower2)
    out["vdoCrossUpLower2"] = (previous < lower2) & (vdo >= lower2)
    out["vdoCrossDownLower"] = (previous > lower) & (vdo <= lower)
    out["vdoCrossUpLower"] = (previous < lower) & (vdo >= lower)
    return out


def calculate_morgan_feature(frame: pd.DataFrame) -> pd.DataFrame:
    level_model, segment_indexes = calculate_morgan_level_model(frame)
    out = pd.DataFrame(index=frame.index)
    out["morganSegmentIndex"] = segment_indexes
    for ratio in MORGAN_LEVEL_RATIOS:
        key = f"morgan_{ratio:g}".replace("-", "neg_").replace(".", "_")
        out[key] = resolve_morgan_levels_from_model(level_model, ratio)
    return out


def build_mmf_v2_features(frame: pd.DataFrame, settings: Any) -> pd.DataFrame:
    metadata_columns = [name for name in ["barKey", "sourceIndex", "calcIndex", "time", "open", "high", "low", "close"] if name in frame.columns]
    features = frame[metadata_columns].copy()
    stoch_k, stoch_d = calculate_stoch_feature(
        frame,
        settings.stoch.length,
        settings.stoch.k_smoothing,
        settings.stoch.d_smoothing,
    )
    features["stochK"] = stoch_k
    features["stochD"] = stoch_d
    vdo_features = calculate_vdo_feature_frame(frame, settings)
    features["ma"] = calculate_ma_feature(frame, settings.ma.length, settings.ma.source, settings.ma.ma_type)
    return pd.concat([features, vdo_features, calculate_morgan_feature(frame)], axis=1)


def _source_series(frame: pd.DataFrame, source: str) -> pd.Series:
    match source:
        case "open":
            return frame["open"]
        case "high":
            return frame["high"]
        case "low":
            return frame["low"]
        case "hl2":
            return (frame["high"] + frame["low"]) / 2
        case "hlc3":
            return (frame["high"] + frame["low"] + frame["close"]) / 3
        case "ohlc4":
            return (frame["open"] + frame["high"] + frame["low"] + frame["close"]) / 4
        case _:
            return frame["close"]


def _h4_morgan_bucket_key(timestamp_seconds: int) -> int:
    return floor((timestamp_seconds - XAU_SESSION_ANCHOR_SECONDS) / H4_MORGAN_SECONDS)


def calculate_morgan_level_model(frame: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
    if frame.empty:
        return pd.Series(dtype="object"), pd.Series(dtype="float64")
    buckets: list[dict[str, Any]] = []
    bucket_by_row: list[int] = []
    active_key: int | None = None
    active: dict[str, Any] | None = None
    times = frame["time"].to_numpy()
    highs = frame["high"].to_numpy()
    lows = frame["low"].to_numpy()
    closes = frame["close"].to_numpy()
    for index in range(len(frame)):
        key = _h4_morgan_bucket_key(int(times[index]))
        if active_key != key or active is None:
            active = {
                "key": key,
                "start_index": int(index),
                "time": int(times[index]),
                "high": float(highs[index]),
                "low": float(lows[index]),
                "close": float(closes[index]),
            }
            buckets.append(active)
            active_key = key
        else:
            active["high"] = max(float(active["high"]), float(highs[index]))
            active["low"] = min(float(active["low"]), float(lows[index]))
            active["close"] = float(closes[index])
        bucket_by_row.append(len(buckets) - 1)

    true_ranges: list[float] = []
    for index, bucket in enumerate(buckets):
        if index == 0:
            true_ranges.append(float(bucket["high"]) - float(bucket["low"]))
            continue
        previous_close = float(buckets[index - 1]["close"])
        true_ranges.append(max(float(bucket["high"]) - float(bucket["low"]), abs(float(bucket["high"]) - previous_close), abs(float(bucket["low"]) - previous_close)))

    atr7: list[float | None] = []
    rolling_tr_sum = 0.0
    for index, true_range in enumerate(true_ranges):
        rolling_tr_sum += true_range
        if index >= 7:
            rolling_tr_sum -= true_ranges[index - 7]
        atr7.append(None if index < 6 else rolling_tr_sum / 7)

    level_bases: list[tuple[float, float] | None] = []
    segment_indexes: list[int | None] = []
    for bucket_index in bucket_by_row:
        if bucket_index <= 0:
            level_bases.append(None)
            segment_indexes.append(None)
            continue
        previous = buckets[bucket_index - 1]
        previous_atr = atr7[bucket_index - 1]
        if previous_atr is None or previous_atr <= 0:
            level_bases.append(None)
            segment_indexes.append(None)
            continue
        center = (float(previous["high"]) + float(previous["low"]) + float(previous["close"])) / 3
        level_bases.append((center, 3 * float(previous_atr)))
        segment_indexes.append(bucket_index)
    return pd.Series(level_bases, index=frame.index, dtype="object"), pd.Series(segment_indexes, index=frame.index, dtype="float64")


def resolve_morgan_levels_from_model(level_model: pd.Series, ratio: float) -> pd.Series:
    return level_model.map(
        lambda item: float(item[0]) + (float(item[1]) * ratio) if isinstance(item, tuple) and len(item) == 2 else None,
    ).astype("float64")
