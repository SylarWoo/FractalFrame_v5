from __future__ import annotations

import pandas as pd

from .features import finite_number
from .marker_factory import create_marker
from .models import MmfV2Marker, MmfV2Settings
from .stoch_state_machine import StochStateSignal
from .trend_retrace import active_trend_at, trend_retrace_events


def create_trend_return_markers(features: pd.DataFrame, signals: list[StochStateSignal], settings: MmfV2Settings) -> list[MmfV2Marker]:
    show_down_return = bool(getattr(settings, "show_trend_down_return_point", False))
    show_up_return = bool(getattr(settings, "show_trend_up_return_point", False))
    if not show_down_return and not show_up_return:
        return []
    trend_events = trend_retrace_events(features)
    if not trend_events:
        return []

    markers: list[MmfV2Marker] = []
    for signal in signals:
        trend = active_trend_at(trend_events, signal.anchor.index)
        if show_down_return and trend == "down" and signal.type == "high" and is_trend_down_return(features, signal, settings):
            markers.append(create_marker(signal, settings, ("MMF_V2_TREND_DOWN_RETURN", "trend_down_return_near_or_above_ma")))
        if show_up_return and trend == "up" and signal.type == "low" and is_trend_up_return(features, signal, settings):
            markers.append(create_marker(signal, settings, ("MMF_V2_TREND_UP_RETURN", "trend_up_return_near_or_below_ma")))
    return markers


def trend_return_signal_indexes(features: pd.DataFrame, signals: list[StochStateSignal], settings: MmfV2Settings) -> dict[str, set[int]]:
    indexes = {"down": set(), "up": set()}
    trend_events = trend_retrace_events(features)
    if not trend_events:
        return indexes
    for signal_index, signal in enumerate(signals):
        trend = active_trend_at(trend_events, signal.anchor.index)
        if trend == "down" and signal.type == "high" and is_trend_down_return(features, signal, settings):
            indexes["down"].add(signal_index)
        if trend == "up" and signal.type == "low" and is_trend_up_return(features, signal, settings):
            indexes["up"].add(signal_index)
    return indexes


def is_trend_down_return(features: pd.DataFrame, signal: StochStateSignal, settings: MmfV2Settings) -> bool:
    row = features.iloc[signal.anchor.index]
    ma = row.get("ma")
    if not finite_number(ma):
        return False
    marker_price = float(signal.anchor.price)
    if _anchor_bar_touches_ma(features, signal.anchor.index):
        return True
    threshold = _trend_return_threshold(row, getattr(settings, "trend_down_return_morgan_ratio", 0.25))
    return finite_number(threshold) and abs(marker_price - float(ma)) <= float(threshold)


def is_trend_up_return(features: pd.DataFrame, signal: StochStateSignal, settings: MmfV2Settings) -> bool:
    row = features.iloc[signal.anchor.index]
    ma = row.get("ma")
    if not finite_number(ma):
        return False
    marker_price = float(signal.anchor.price)
    if _anchor_bar_touches_ma(features, signal.anchor.index):
        return True
    threshold = _trend_return_threshold(row, getattr(settings, "trend_up_return_morgan_ratio", 0.25))
    return finite_number(threshold) and abs(marker_price - float(ma)) <= float(threshold)


def _anchor_bar_touches_ma(features: pd.DataFrame, index: int) -> bool:
    row = features.iloc[index]
    ma = row.get("ma")
    high = row.get("high")
    low = row.get("low")
    return (
        finite_number(ma)
        and finite_number(high)
        and finite_number(low)
        and float(low) <= float(ma) <= float(high)
    )


def _trend_return_threshold(row: pd.Series, ratio: float) -> float | None:
    true_range = row.get("morgan_true_range")
    if not finite_number(true_range):
        return None
    return float(true_range) * max(0.0, float(ratio))
