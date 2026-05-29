from __future__ import annotations

import pandas as pd

from .features import finite_number
from .marker_factory import create_marker
from .models import MmfV2Marker, MmfV2Settings
from .stoch_state_machine import StochStateSignal


def create_expected_level_markers(features: pd.DataFrame, signals: list[StochStateSignal], settings: MmfV2Settings) -> list[MmfV2Marker]:
    show_support = bool(getattr(settings, "show_expected_support_level", False))
    show_resistance = bool(getattr(settings, "show_expected_resistance_level", False))
    if not show_support and not show_resistance:
        return []
    trend_events = _trend_expected_level_events(features)
    if not trend_events:
        return []

    markers: list[MmfV2Marker] = []
    for signal in signals:
        if not _is_expected_level_window_active(trend_events, signal.anchor.index):
            continue
        if show_resistance and signal.type == "high" and _is_expected_resistance(features, signal):
            markers.append(create_marker(signal, settings, ("MMF_V2_EXPECTED_RESISTANCE", "expected_resistance_after_trend_close")))
        if show_support and signal.type == "low" and _is_expected_support(features, signal):
            markers.append(create_marker(signal, settings, ("MMF_V2_EXPECTED_SUPPORT", "expected_support_after_trend_close")))
    return markers


def _trend_expected_level_events(features: pd.DataFrame) -> list[tuple[int, bool]]:
    specs = (
        ("vdoCrossUpLower", True),
        ("vdoCrossDownUpper", True),
        ("vdoCrossDownLower", False),
        ("vdoCrossUpUpper", False),
    )
    events: list[tuple[int, bool]] = []
    for column, active in specs:
        if column not in features.columns:
            continue
        values = features[column].to_numpy()
        events.extend((index, active) for index in range(len(features)) if bool(values[index]))
    return sorted(events, key=lambda event: (event[0], 0 if event[1] else 1))


def _is_expected_level_window_active(events: list[tuple[int, bool]], signal_index: int) -> bool:
    active = False
    for event_index, event_active in events:
        if event_index >= signal_index:
            break
        active = event_active
    return active


def _is_expected_resistance(features: pd.DataFrame, signal: StochStateSignal) -> bool:
    if "morgan_center" not in features.columns or "morgan_true_range" not in features.columns:
        return False
    row = features.iloc[signal.anchor.index]
    morgan_level = _expected_resistance_level(row)
    return finite_number(morgan_level) and signal.anchor.price >= float(morgan_level)


def _is_expected_support(features: pd.DataFrame, signal: StochStateSignal) -> bool:
    if "morgan_center" not in features.columns or "morgan_true_range" not in features.columns:
        return False
    row = features.iloc[signal.anchor.index]
    morgan_level = _expected_support_level(row)
    return finite_number(morgan_level) and signal.anchor.price <= float(morgan_level)


def _expected_resistance_level(row: pd.Series) -> float | None:
    center = row.get("morgan_center")
    true_range = row.get("morgan_true_range")
    if not finite_number(center) or not finite_number(true_range):
        return None
    return float(center) + (float(true_range) * 0.25)


def _expected_support_level(row: pd.Series) -> float | None:
    center = row.get("morgan_center")
    true_range = row.get("morgan_true_range")
    if not finite_number(center) or not finite_number(true_range):
        return None
    return float(center) - (float(true_range) * 0.25)
