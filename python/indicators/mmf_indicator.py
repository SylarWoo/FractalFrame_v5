from __future__ import annotations

from dataclasses import dataclass
from math import floor, isfinite
from typing import Any

import pandas as pd

H4_MORGAN_SECONDS = 4 * 60 * 60
XAU_SESSION_ANCHOR_SECONDS = 22 * 60 * 60
MORGAN_LEVEL_RATIOS = (-1, -0.786, -0.618, -0.5, -0.382, -0.236, -0.177, -0.118, -0.059, 0, 0.059, 0.118, 0.177, 0.236, 0.382, 0.5, 0.618, 0.786, 1)
MMF_HIGH_STOCH_ZONE_LEVEL = 70
MMF_HIGH_STOCH_REVERSAL_LEVEL = 65
MMF_LOW_STOCH_ZONE_LEVEL = 30
MMF_LOW_STOCH_REVERSAL_LEVEL = 35
MMF_HIGH_CROSS_MIN_LEVEL = 60
MMF_LOW_CROSS_MAX_LEVEL = 40
MMF_STOCH_CONFIRM_DISTANCE = 7
MMF_CROSS_WINDOW_RADIUS = 7


@dataclass(frozen=True)
class MmfSettings:
    show_high: bool = True
    show_low: bool = True
    dpo_value: float = 11
    high_morgan_ratio: float = 0.118
    high_offset_percent: float = 0
    low_dpo_value: float = -11
    low_morgan_ratio: float = -0.118
    low_offset_percent: float = 0
    stoch_length: int = 14
    stoch_k_smoothing: int = 3
    stoch_d_smoothing: int = 3
    dpo_length: int = 21


@dataclass
class MmfActiveState:
    start_index: int
    highest_high: float
    highest_high_index: int
    has_filter_match: bool = False
    reached_reversal_zone: bool = False
    end_index: int | None = None


@dataclass
class MmfLowActiveState:
    start_index: int
    lowest_low: float
    lowest_low_index: int
    has_filter_match: bool = False
    reached_reversal_zone: bool = False
    end_index: int | None = None


@dataclass(frozen=True)
class MmfPrecomputedData:
    rows_count: int
    times: Any
    highs: Any
    lows: Any
    dpos: Any
    stoch_k: Any
    stoch_d: Any
    morgan_levels: Any
    low_morgan_levels: Any
    segment_indexes: Any


def _finite_number(value: Any) -> bool:
    try:
        return isfinite(float(value))
    except (TypeError, ValueError):
        return False


def _safe_float(value: Any) -> float | None:
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    return out if isfinite(out) else None


def _normalize_ohlcv_frame(rows: list[dict[str, Any]] | pd.DataFrame) -> pd.DataFrame:
    frame = rows.copy() if isinstance(rows, pd.DataFrame) else pd.DataFrame(rows)
    if frame.empty:
        return pd.DataFrame(columns=["time", "open", "high", "low", "close", "volume"])
    required = ["time", "open", "high", "low", "close"]
    missing = [name for name in required if name not in frame.columns]
    if missing:
        raise ValueError(f"OHLCV rows missing required columns: {', '.join(missing)}")
    frame = frame.copy()
    for name in ["time", "open", "high", "low", "close", "volume"]:
        if name in frame.columns:
            frame[name] = pd.to_numeric(frame[name], errors="coerce")
    frame = frame.dropna(subset=["time", "open", "high", "low", "close"])
    frame = frame.sort_values("time").drop_duplicates(subset=["time"], keep="last").reset_index(drop=True)
    return frame


def resolve_adjusted_morgan_ratio(high_morgan_ratio: float, high_offset_percent: float) -> float:
    selected = _safe_float(high_morgan_ratio)
    if selected is None:
        return 0.118
    sign = -1 if selected < 0 else 1
    selected_magnitude = abs(selected)
    offset = max(-99, min(round(float(high_offset_percent or 0)), 99))
    if offset == 0:
        return sign * selected_magnitude
    upper_ratios = [0.059, 0.118, 0.177, 0.236, 0.309]
    index = next((idx for idx, ratio in enumerate(upper_ratios) if abs(ratio - selected_magnitude) < 0.0005), -1)
    if index < 0:
        return sign * selected_magnitude
    target = upper_ratios[min(len(upper_ratios) - 1, index + 1)] if offset > 0 else upper_ratios[max(0, index - 1)]
    return sign * (selected_magnitude + (target - selected_magnitude) * (abs(offset) / 100))


def calculate_dpo(close: pd.Series, length: int = 21) -> pd.Series:
    safe_length = max(1, int(length or 21))
    bars_back = floor(safe_length / 2) + 1
    sma = close.rolling(window=safe_length, min_periods=safe_length).mean()
    return close - sma.shift(bars_back)


def calculate_stoch(frame: pd.DataFrame, length: int = 14, k_smoothing: int = 3, d_smoothing: int = 3) -> tuple[pd.Series, pd.Series]:
    safe_length = max(1, int(length or 14))
    safe_k = max(1, int(k_smoothing or 3))
    safe_d = max(1, int(d_smoothing or 3))
    highest_high = frame["high"].rolling(window=safe_length, min_periods=safe_length).max()
    lowest_low = frame["low"].rolling(window=safe_length, min_periods=safe_length).min()
    price_range = highest_high - lowest_low
    raw_k = ((frame["close"] - lowest_low) / price_range) * 100
    raw_k = raw_k.where(price_range != 0)
    k = raw_k.rolling(window=safe_k, min_periods=safe_k).mean()
    d = k.rolling(window=safe_d, min_periods=safe_d).mean()
    return k, d


def _h4_morgan_bucket_key(timestamp_seconds: int) -> int:
    return floor((timestamp_seconds - XAU_SESSION_ANCHOR_SECONDS) / H4_MORGAN_SECONDS)


def calculate_morgan_level_model(frame: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
    if frame.empty:
        return pd.Series(dtype="float64"), pd.Series(dtype="float64")
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
    for index in range(len(true_ranges)):
        rolling_tr_sum += true_ranges[index]
        if index >= 7:
            rolling_tr_sum -= true_ranges[index - 7]
        if index < 6:
            atr7.append(None)
        else:
            atr7.append(rolling_tr_sum / 7)

    level_bases: list[float | None] = []
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


def calculate_morgan_levels(frame: pd.DataFrame, ratio: float) -> tuple[pd.Series, pd.Series]:
    level_model, segment_indexes = calculate_morgan_level_model(frame)
    return resolve_morgan_levels_from_model(level_model, ratio), segment_indexes


def _stoch_lines_break_below(previous_k: Any, previous_d: Any, k: Any, d: Any, threshold: float) -> bool:
    if not (_finite_number(previous_k) and _finite_number(previous_d) and _finite_number(k) and _finite_number(d)):
        return False
    previous_max = max(float(previous_k), float(previous_d))
    current_max = max(float(k), float(d))
    return previous_max > threshold and current_max <= threshold


def _stoch_lines_break_above(previous_k: Any, previous_d: Any, k: Any, d: Any, threshold: float) -> bool:
    if not (_finite_number(previous_k) and _finite_number(previous_d) and _finite_number(k) and _finite_number(d)):
        return False
    previous_min = min(float(previous_k), float(previous_d))
    current_min = min(float(k), float(d))
    return previous_min < threshold and current_min >= threshold


def _stoch_lines_are_above(k: Any, d: Any, threshold: float) -> bool:
    if not (_finite_number(k) and _finite_number(d)):
        return False
    return min(float(k), float(d)) >= threshold


def _stoch_lines_are_below(k: Any, d: Any, threshold: float) -> bool:
    if not (_finite_number(k) and _finite_number(d)):
        return False
    return max(float(k), float(d)) <= threshold


def _value_crosses_above(previous_value: Any, value: Any, threshold: float) -> bool:
    if not (_finite_number(previous_value) and _finite_number(value)):
        return False
    return float(previous_value) < threshold and float(value) >= threshold


def _value_crosses_below(previous_value: Any, value: Any, threshold: float) -> bool:
    if not (_finite_number(previous_value) and _finite_number(value)):
        return False
    return float(previous_value) > threshold and float(value) <= threshold


def _price_crosses_above_level(previous_price: Any, price: Any, previous_level: Any, level: Any) -> bool:
    if not (_finite_number(previous_price) and _finite_number(price) and _finite_number(previous_level) and _finite_number(level)):
        return False
    return float(previous_price) < float(previous_level) and float(price) >= float(level)


def _price_crosses_below_level(previous_price: Any, price: Any, previous_level: Any, level: Any) -> bool:
    if not (_finite_number(previous_price) and _finite_number(price) and _finite_number(previous_level) and _finite_number(level)):
        return False
    return float(previous_price) > float(previous_level) and float(price) <= float(level)


def _stoch_cross_value(previous_k: Any, previous_d: Any, k: Any, d: Any) -> float | None:
    if not (_finite_number(previous_k) and _finite_number(previous_d) and _finite_number(k) and _finite_number(d)):
        return None
    previous_k_float = float(previous_k)
    previous_d_float = float(previous_d)
    k_delta = float(k) - previous_k_float
    d_delta = float(d) - previous_d_float
    denominator = k_delta - d_delta
    if denominator == 0:
        return None
    ratio = (previous_d_float - previous_k_float) / denominator
    if ratio < 0 or ratio > 1:
        return None
    return previous_k_float + k_delta * ratio


def _stoch_dead_cross_value_above(previous_k: Any, previous_d: Any, k: Any, d: Any, threshold: float) -> bool:
    if not (_finite_number(previous_k) and _finite_number(previous_d) and _finite_number(k) and _finite_number(d)):
        return False
    if not (float(previous_k) >= float(previous_d) and float(k) < float(d)):
        return False
    cross_value = _stoch_cross_value(previous_k, previous_d, k, d)
    return cross_value is not None and cross_value > threshold


def _stoch_golden_cross_value_below(previous_k: Any, previous_d: Any, k: Any, d: Any, threshold: float) -> bool:
    if not (_finite_number(previous_k) and _finite_number(previous_d) and _finite_number(k) and _finite_number(d)):
        return False
    if not (float(previous_k) <= float(previous_d) and float(k) > float(d)):
        return False
    cross_value = _stoch_cross_value(previous_k, previous_d, k, d)
    return cross_value is not None and cross_value < threshold


def _stoch_dead_cross_value(previous_k: Any, previous_d: Any, k: Any, d: Any) -> float | None:
    if not (_finite_number(previous_k) and _finite_number(previous_d) and _finite_number(k) and _finite_number(d)):
        return None
    if not (float(previous_k) >= float(previous_d) and float(k) < float(d)):
        return None
    return _stoch_cross_value(previous_k, previous_d, k, d)


def _stoch_golden_cross_value(previous_k: Any, previous_d: Any, k: Any, d: Any) -> float | None:
    if not (_finite_number(previous_k) and _finite_number(previous_d) and _finite_number(k) and _finite_number(d)):
        return None
    if not (float(previous_k) <= float(previous_d) and float(k) > float(d)):
        return None
    return _stoch_cross_value(previous_k, previous_d, k, d)


def _centered_window(index: int, rows_count: int, radius: int = MMF_CROSS_WINDOW_RADIUS) -> tuple[int, int]:
    return max(0, index - radius), min(rows_count - 1, index + radius)


def _window_has_high_filter(precomputed: MmfPrecomputedData, settings: MmfSettings, start_index: int, end_index: int) -> bool:
    for index in range(start_index, end_index + 1):
        dpo = precomputed.dpos[index]
        high = precomputed.highs[index]
        morgan_level = precomputed.morgan_levels[index]
        if _finite_number(dpo) and float(dpo) >= float(settings.dpo_value):
            return True
        if _finite_number(high) and _finite_number(morgan_level) and float(high) >= float(morgan_level):
            return True
    return False


def _window_has_low_filter(precomputed: MmfPrecomputedData, settings: MmfSettings, start_index: int, end_index: int) -> bool:
    low_dpo_threshold = -abs(float(settings.low_dpo_value))
    for index in range(start_index, end_index + 1):
        dpo = precomputed.dpos[index]
        low = precomputed.lows[index]
        low_morgan_level = precomputed.low_morgan_levels[index]
        if _finite_number(dpo) and float(dpo) <= low_dpo_threshold:
            return True
        if _finite_number(low) and _finite_number(low_morgan_level) and float(low) <= float(low_morgan_level):
            return True
    return False


def _highest_high_index(precomputed: MmfPrecomputedData, start_index: int, end_index: int) -> int | None:
    highest_index: int | None = None
    highest_value: float | None = None
    for index in range(start_index, end_index + 1):
        high = precomputed.highs[index]
        if not _finite_number(high):
            continue
        high_value = float(high)
        if highest_value is None or high_value > highest_value:
            highest_value = high_value
            highest_index = index
    return highest_index


def _lowest_low_index(precomputed: MmfPrecomputedData, start_index: int, end_index: int) -> int | None:
    lowest_index: int | None = None
    lowest_value: float | None = None
    for index in range(start_index, end_index + 1):
        low = precomputed.lows[index]
        if not _finite_number(low):
            continue
        low_value = float(low)
        if lowest_value is None or low_value < lowest_value:
            lowest_value = low_value
            lowest_index = index
    return lowest_index


def _better_extreme_marker(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
    marker_type = str(left.get("type"))
    left_price = float(left["price"])
    right_price = float(right["price"])
    if marker_type == "MMF_HIGH":
        if right_price > left_price:
            return right
        if right_price == left_price and int(right["index"]) > int(left["index"]):
            return right
        return left
    if marker_type == "MMF_LOW":
        if right_price < left_price:
            return right
        if right_price == left_price and int(right["index"]) > int(left["index"]):
            return right
        return left
    return left


def _dedupe_extreme_markers(marker_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    for marker_type in ("MMF_HIGH", "MMF_LOW"):
        typed_markers = sorted(
            [marker for marker in marker_records if marker.get("type") == marker_type],
            key=lambda marker: (int(marker["startIndex"]), int(marker["endIndex"]), int(marker["index"])),
        )
        active_group: list[dict[str, Any]] = []
        active_end_index: int | None = None
        for marker in typed_markers:
            if not active_group:
                active_group = [marker]
                active_end_index = int(marker["endIndex"])
                continue
            if active_end_index is not None and int(marker["startIndex"]) <= active_end_index:
                active_group.append(marker)
                active_end_index = max(active_end_index, int(marker["endIndex"]))
                continue
            winner = active_group[0]
            for candidate in active_group[1:]:
                winner = _better_extreme_marker(winner, candidate)
            deduped.append(winner)
            active_group = [marker]
            active_end_index = int(marker["endIndex"])
        if active_group:
            winner = active_group[0]
            for candidate in active_group[1:]:
                winner = _better_extreme_marker(winner, candidate)
            deduped.append(winner)

    deduped.extend(marker for marker in marker_records if marker.get("type") not in {"MMF_HIGH", "MMF_LOW"})
    return deduped


def calculate_mmf_precomputed_data(frame: pd.DataFrame, settings: MmfSettings) -> MmfPrecomputedData:
    dpo = calculate_dpo(frame["close"], settings.dpo_length)
    stoch_k, stoch_d = calculate_stoch(frame, settings.stoch_length, settings.stoch_k_smoothing, settings.stoch_d_smoothing)
    high_ratio = resolve_adjusted_morgan_ratio(settings.high_morgan_ratio, settings.high_offset_percent)
    low_ratio = -abs(resolve_adjusted_morgan_ratio(settings.low_morgan_ratio, settings.low_offset_percent))
    morgan_level_model, segment_indexes = calculate_morgan_level_model(frame)
    empty_levels = pd.Series([None] * len(frame), index=frame.index, dtype="float64")
    morgan_levels = resolve_morgan_levels_from_model(morgan_level_model, high_ratio) if settings.show_high else empty_levels
    low_morgan_levels = resolve_morgan_levels_from_model(morgan_level_model, low_ratio) if settings.show_low else empty_levels

    return MmfPrecomputedData(
        rows_count=int(len(frame)),
        times=frame["time"].to_numpy(),
        highs=frame["high"].to_numpy(),
        lows=frame["low"].to_numpy(),
        dpos=dpo.to_numpy(),
        stoch_k=stoch_k.to_numpy(),
        stoch_d=stoch_d.to_numpy(),
        morgan_levels=morgan_levels.to_numpy(),
        low_morgan_levels=low_morgan_levels.to_numpy(),
        segment_indexes=segment_indexes.to_numpy(),
    )


def calculate_mmf_markers_from_precomputed(precomputed: MmfPrecomputedData, settings: MmfSettings, include_rows: bool = False) -> dict[str, Any]:
    if precomputed.rows_count <= 0:
        return {"ok": True, "rowsCount": 0, "markersCount": 0, "markers": [], "rows": []}
    if not settings.show_high and not settings.show_low:
        return {"ok": True, "rowsCount": precomputed.rows_count, "markersCount": 0, "markers": [], "rows": []}

    times = precomputed.times
    highs = precomputed.highs
    lows = precomputed.lows
    dpos = precomputed.dpos
    stoch_k = precomputed.stoch_k
    stoch_d = precomputed.stoch_d
    morgan_levels = precomputed.morgan_levels
    low_morgan_levels = precomputed.low_morgan_levels
    segment_indexes = precomputed.segment_indexes

    marker_records: list[dict[str, Any]] = []
    active_high_cross: dict[str, float | int] | None = None
    active_low_cross: dict[str, float | int] | None = None

    for index in range(1, precomputed.rows_count):
        k = stoch_k[index]
        d = stoch_d[index]
        previous_k = stoch_k[index - 1]
        previous_d = stoch_d[index - 1]

        if settings.show_high:
            if active_high_cross is not None and index > int(active_high_cross["index"]) and _finite_number(k):
                cross_value = float(active_high_cross["value"])
                cross_index = int(active_high_cross["index"])
                if float(k) <= cross_value - MMF_STOCH_CONFIRM_DISTANCE:
                    start_index, end_index = _centered_window(cross_index, precomputed.rows_count)
                    high_index = _highest_high_index(precomputed, start_index, end_index)
                    if high_index is not None and _window_has_high_filter(precomputed, settings, start_index, end_index):
                        marker_records.append({
                            "type": "MMF_HIGH",
                            "index": high_index,
                            "time": int(times[high_index]),
                            "price": float(highs[high_index]),
                            "startIndex": start_index,
                            "startTime": int(times[start_index]),
                            "endIndex": end_index,
                            "endTime": int(times[end_index]),
                            "confirmThreshold": MMF_HIGH_CROSS_MIN_LEVEL,
                            "confirmCrossIndex": index,
                            "crossIndex": cross_index,
                            "crossValue": cross_value,
                        })
                    active_high_cross = None

            dead_cross_value = _stoch_dead_cross_value(previous_k, previous_d, k, d)
            if dead_cross_value is not None and dead_cross_value >= MMF_HIGH_CROSS_MIN_LEVEL:
                active_high_cross = {"index": index, "value": float(dead_cross_value)}

        if settings.show_low:
            if active_low_cross is not None and index > int(active_low_cross["index"]) and _finite_number(k):
                cross_value = float(active_low_cross["value"])
                cross_index = int(active_low_cross["index"])
                if float(k) >= cross_value + MMF_STOCH_CONFIRM_DISTANCE:
                    start_index, end_index = _centered_window(cross_index, precomputed.rows_count)
                    low_index = _lowest_low_index(precomputed, start_index, end_index)
                    if low_index is not None and _window_has_low_filter(precomputed, settings, start_index, end_index):
                        marker_records.append({
                            "type": "MMF_LOW",
                            "index": low_index,
                            "time": int(times[low_index]),
                            "price": float(lows[low_index]),
                            "startIndex": start_index,
                            "startTime": int(times[start_index]),
                            "endIndex": end_index,
                            "endTime": int(times[end_index]),
                            "confirmThreshold": MMF_LOW_CROSS_MAX_LEVEL,
                            "confirmCrossIndex": index,
                            "crossIndex": cross_index,
                            "crossValue": cross_value,
                        })
                    active_low_cross = None

            golden_cross_value = _stoch_golden_cross_value(previous_k, previous_d, k, d)
            if golden_cross_value is not None and golden_cross_value <= MMF_LOW_CROSS_MAX_LEVEL:
                active_low_cross = {"index": index, "value": float(golden_cross_value)}

    marker_records = _dedupe_extreme_markers(marker_records)
    markers = sorted(marker_records, key=lambda marker: (int(marker["index"]), str(marker["type"])))
    debug_rows = []
    if include_rows:
        debug_rows = [
            {
                "time": int(times[index]),
                "dpo": _safe_float(dpos[index]),
                "stochK": _safe_float(stoch_k[index]),
                "stochD": _safe_float(stoch_d[index]),
                "morganLevel": _safe_float(morgan_levels[index]),
                "lowMorganLevel": _safe_float(low_morgan_levels[index]),
                "morganSegmentIndex": int(segment_indexes[index]) if _finite_number(segment_indexes[index]) else None,
            }
            for index in range(precomputed.rows_count)
        ]
    return {
        "ok": True,
        "rowsCount": precomputed.rows_count,
        "markersCount": len(markers),
        "markers": markers,
        "rows": debug_rows,
    }


def calculate_mmf_high_markers(rows: list[dict[str, Any]] | pd.DataFrame, settings: MmfSettings | None = None, include_rows: bool = False) -> dict[str, Any]:
    active_settings = settings or MmfSettings()
    frame = _normalize_ohlcv_frame(rows)
    if frame.empty:
        return {"ok": True, "rowsCount": 0, "markersCount": 0, "markers": [], "rows": []}
    precomputed = calculate_mmf_precomputed_data(frame, active_settings)
    return calculate_mmf_markers_from_precomputed(precomputed, active_settings, include_rows)
