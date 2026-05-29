from __future__ import annotations

import pandas as pd

from .features import finite_number
from .marker_factory import create_marker
from .models import MmfV2Marker, MmfV2Settings
from .stoch_state_machine import StochStateSignal
from .trend_return import trend_return_signal_indexes


def create_trend_divergence_markers(features: pd.DataFrame, signals: list[StochStateSignal], settings: MmfV2Settings) -> list[MmfV2Marker]:
    show_down_divergence = bool(getattr(settings, "show_trend_down_divergence_point", False))
    show_up_divergence = bool(getattr(settings, "show_trend_up_divergence_point", False))
    if not show_down_divergence and not show_up_divergence:
        return []
    return_signal_indexes = trend_return_signal_indexes(features, signals, settings)

    markers: list[MmfV2Marker] = []
    previous_signal_index: int | None = None
    for signal_index, signal in enumerate(signals):
        if signal.type == "low":
            if (
                show_down_divergence
                and _previous_signal_is_return(signals, previous_signal_index, return_signal_indexes["down"], "high")
                and _is_trend_down_divergence(features, signal, settings)
            ):
                markers.append(create_marker(signal, settings, ("MMF_V2_TREND_DOWN_DIVERGENCE", "trend_down_divergence_after_return_low_below_morgan")))
            previous_signal_index = signal_index
            continue
        if (
            show_up_divergence
            and _previous_signal_is_return(signals, previous_signal_index, return_signal_indexes["up"], "low")
            and _is_trend_up_divergence(features, signal, settings)
        ):
            markers.append(create_marker(signal, settings, ("MMF_V2_TREND_UP_DIVERGENCE", "trend_up_divergence_after_return_high_above_morgan")))
        previous_signal_index = signal_index
    return markers


def _previous_signal_is_return(signals: list[StochStateSignal], previous_signal_index: int | None, return_signal_indexes: set[int], expected_type: str) -> bool:
    if previous_signal_index is None or previous_signal_index not in return_signal_indexes:
        return False
    return signals[previous_signal_index].type == expected_type


def _is_trend_down_divergence(features: pd.DataFrame, signal: StochStateSignal, settings: MmfV2Settings) -> bool:
    level = _morgan_center_offset_level(features.iloc[signal.anchor.index], -abs(float(getattr(settings, "trend_down_divergence_morgan_ratio", 0.375))))
    return finite_number(level) and signal.anchor.price <= float(level)


def _is_trend_up_divergence(features: pd.DataFrame, signal: StochStateSignal, settings: MmfV2Settings) -> bool:
    level = _morgan_center_offset_level(features.iloc[signal.anchor.index], abs(float(getattr(settings, "trend_up_divergence_morgan_ratio", 0.375))))
    return finite_number(level) and signal.anchor.price >= float(level)


def _morgan_center_offset_level(row: pd.Series, ratio: float) -> float | None:
    center = row.get("morgan_center")
    true_range = row.get("morgan_true_range")
    if not finite_number(center) or not finite_number(true_range):
        return None
    return float(center) + (float(true_range) * ratio)
