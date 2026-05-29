from __future__ import annotations

import pandas as pd

from .marker_factory import create_marker
from .models import MmfV2Marker, MmfV2Settings
from .stoch_state_machine import StochStateSignal


def create_trend_retrace_markers(features: pd.DataFrame, signals: list[StochStateSignal], settings: MmfV2Settings) -> list[MmfV2Marker]:
    show_rebound = bool(getattr(settings, "show_trend_down_rebound_point", False))
    show_pullback = bool(getattr(settings, "show_trend_up_pullback_point", False))
    if not show_rebound and not show_pullback:
        return []
    trend_events = trend_retrace_events(features)
    if not trend_events:
        return []

    markers: list[MmfV2Marker] = []
    for signal in signals:
        trend = active_trend_at(trend_events, signal.anchor.index)
        if show_rebound and trend == "down" and signal.type == "high":
            markers.append(create_marker(signal, settings, ("MMF_V2_TREND_DOWN_REBOUND", "trend_down_rebound_after_support_down_break")))
        if show_pullback and trend == "up" and signal.type == "low":
            markers.append(create_marker(signal, settings, ("MMF_V2_TREND_UP_PULLBACK", "trend_up_pullback_after_resistance_up_break")))
    return markers


def trend_retrace_events(features: pd.DataFrame) -> list[tuple[int, str | None]]:
    specs = (
        ("vdoCrossDownLower", "down"),
        ("vdoCrossUpLower", None),
        ("vdoCrossUpUpper", "up"),
        ("vdoCrossDownUpper", None),
    )
    events: list[tuple[int, str | None]] = []
    for column, trend in specs:
        if column not in features.columns:
            continue
        values = features[column].to_numpy()
        events.extend((index, trend) for index in range(len(features)) if bool(values[index]))
    return sorted(events, key=lambda event: (event[0], 0 if event[1] is not None else 1))


def active_trend_at(events: list[tuple[int, str | None]], signal_index: int) -> str | None:
    trend: str | None = None
    for event_index, event_trend in events:
        if event_index >= signal_index:
            break
        trend = event_trend
    return trend
