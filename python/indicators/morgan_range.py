from __future__ import annotations

from math import floor
from typing import Any

import pandas as pd

H4_MORGAN_SECONDS = 4 * 60 * 60
XAU_SESSION_ANCHOR_SECONDS = 22 * 60 * 60
MORGAN_LEVEL_RATIOS = (-1, -0.786, -0.618, -0.5, -0.382, -0.236, -0.177, -0.118, -0.059, 0, 0.059, 0.118, 0.177, 0.236, 0.382, 0.5, 0.618, 0.786, 1)
MORGAN_TRUE_RANGE_RATIO = 0.236 - (-0.236)


def h4_morgan_bucket_key(timestamp_seconds: int) -> int:
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
        key = h4_morgan_bucket_key(int(times[index]))
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


def resolve_morgan_true_range_from_model(level_model: pd.Series) -> pd.Series:
    return level_model.map(
        lambda item: float(item[1]) * MORGAN_TRUE_RANGE_RATIO if isinstance(item, tuple) and len(item) == 2 else None,
    ).astype("float64")


def resolve_morgan_center_from_model(level_model: pd.Series) -> pd.Series:
    return level_model.map(
        lambda item: float(item[0]) if isinstance(item, tuple) and len(item) == 2 else None,
    ).astype("float64")


def calculate_morgan_levels(frame: pd.DataFrame, ratio: float) -> tuple[pd.Series, pd.Series]:
    level_model, segment_indexes = calculate_morgan_level_model(frame)
    return resolve_morgan_levels_from_model(level_model, ratio), segment_indexes
