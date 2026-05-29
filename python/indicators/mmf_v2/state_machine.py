from __future__ import annotations

import pandas as pd

from .features import finite_number
from .models import MmfV2Marker, MmfV2Settings, create_mmf_v2_marker
from .stoch_state_machine import StochStateSignal, calculate_stoch_state_signals


def calculate_mmf_v2_state_machine_markers(features: pd.DataFrame, settings: MmfV2Settings) -> list[MmfV2Marker]:
    signals = calculate_stoch_state_signals(features, settings)
    classifications = _classify_vdo_levels(features, signals, settings)
    markers = [_create_marker(signal, settings, classifications.get(index)) for index, signal in enumerate(signals)]
    markers.extend(_create_expected_level_markers(features, signals, settings))
    markers.extend(_create_trend_retrace_markers(features, signals, settings))
    markers.extend(_create_trend_return_markers(features, signals, settings))
    markers.extend(_create_trend_divergence_markers(features, signals, settings))
    markers.extend(_create_vdo_break_markers(features, settings))
    return sorted(markers, key=lambda marker: (marker.marker.index, marker.type))


def _create_marker(signal: StochStateSignal, settings: MmfV2Settings, classification: tuple[str, str] | None = None) -> MmfV2Marker:
    marker_type = "MMF_V2_HIGH" if signal.type == "high" else "MMF_V2_LOW"
    if classification is not None:
        marker_type = classification[0]
    return create_mmf_v2_marker(
        type=marker_type,
        event_index=signal.cross.index,
        event_bar_key=signal.cross.bar_key,
        event_time=signal.cross.time,
        confirm_index=signal.confirm.index,
        confirm_bar_key=signal.confirm.bar_key,
        confirm_time=signal.confirm.time,
        marker_index=signal.anchor.index,
        marker_bar_key=signal.anchor.bar_key,
        marker_time=signal.anchor.time,
        marker_price=signal.anchor.price,
        entry_index=signal.entry_index,
        entry_bar_key=signal.entry_bar_key,
        entry_time=signal.entry_time,
        entry_price=signal.entry_price,
        point_distance=signal.point_distance,
        window_start_index=signal.anchor.window_start_index,
        window_start_bar_key=signal.anchor.window_start_bar_key,
        window_start_time=signal.anchor.window_start_time,
        window_end_index=signal.anchor.window_end_index,
        window_end_bar_key=signal.anchor.window_end_bar_key,
        window_end_time=signal.anchor.window_end_time,
        reason=_create_reason(signal, settings, classification),
    )


def _create_reason(signal: StochStateSignal, settings: MmfV2Settings, classification: tuple[str, str] | None = None) -> tuple[str, ...]:
    classified_reason = (classification[1],) if classification is not None else ()
    if signal.type == "high":
        return (
            "stoch_dead_cross",
            "stoch_cross_detected",
            f"confirm_within_{signal.confirm.max_bars}_bars",
            f"anchor_left_of_cross_{settings.high_anchor_lookback_bars}_bars",
            f"stoch_down_advance_{settings.high_stoch_k_advance:g}",
            "highest_high_anchor",
            *classified_reason,
        )
    return (
        "stoch_golden_cross",
        "stoch_cross_detected",
        f"confirm_within_{signal.confirm.max_bars}_bars",
        f"anchor_left_of_cross_{settings.low_anchor_lookback_bars}_bars",
        f"stoch_up_advance_{settings.low_stoch_k_advance:g}",
        "lowest_low_anchor",
        *classified_reason,
    )


def _classify_vdo_levels(features: pd.DataFrame, signals: list[StochStateSignal], settings: MmfV2Settings) -> dict[int, tuple[str, str]]:
    classifications: dict[int, tuple[str, str]] = {}
    if bool(getattr(settings, "show_support_level", False)):
        classifications.update(_classify_support_levels(features, signals))
    if bool(getattr(settings, "show_resistance_level", False)):
        classifications.update(_classify_resistance_levels(features, signals))
    return classifications


def _classify_support_levels(features: pd.DataFrame, signals: list[StochStateSignal]) -> dict[int, tuple[str, str]]:
    low_candidates = [(index, signal) for index, signal in enumerate(signals) if signal.type == "low"]
    if not low_candidates:
        return {}
    classifications: dict[int, tuple[str, str]] = {}
    for start, end, reason, priority in _support_vdo_windows(features):
        candidate = _lowest_signal_in_window(low_candidates, start, end)
        if candidate is None:
            continue
        current = classifications.get(candidate[0])
        if current is None or priority > _classification_priority(current[1]):
            classifications[candidate[0]] = ("MMF_V2_SUPPORT", reason)
    return classifications


def _classify_resistance_levels(features: pd.DataFrame, signals: list[StochStateSignal]) -> dict[int, tuple[str, str]]:
    high_candidates = [(index, signal) for index, signal in enumerate(signals) if signal.type == "high"]
    if not high_candidates:
        return {}
    classifications: dict[int, tuple[str, str]] = {}
    for start, end, reason, priority in _resistance_vdo_windows(features):
        candidate = _highest_signal_in_window(high_candidates, start, end)
        if candidate is None:
            continue
        current = classifications.get(candidate[0])
        if current is None or priority > _classification_priority(current[1]):
            classifications[candidate[0]] = ("MMF_V2_RESISTANCE", reason)
    return classifications


def _support_vdo_windows(features: pd.DataFrame) -> list[tuple[int, int, str, int]]:
    lower2_windows = _vdo_cross_windows(features, "vdoCrossDownLower2", "vdoCrossUpLower2")
    lower_windows = _vdo_cross_windows(features, "vdoCrossDownLower", "vdoCrossUpLower")
    windows: list[tuple[int, int, str, int]] = []
    for start, end in lower2_windows:
        windows.append((start, end, "support_vdo_down_up_neg_0_05", 1))
        if _window_min(features, start, end) >= -0.1:
            windows.append((start, end, "support_vdo_down_up_neg_0_05_no_below_neg_0_10", 2))
    for start, end in lower_windows:
        windows.append((start, end, "support_vdo_down_up_neg_0_10", 3))
    return windows


def _resistance_vdo_windows(features: pd.DataFrame) -> list[tuple[int, int, str, int]]:
    upper2_windows = _vdo_cross_windows(features, "vdoCrossUpUpper2", "vdoCrossDownUpper2")
    upper_windows = _vdo_cross_windows(features, "vdoCrossUpUpper", "vdoCrossDownUpper")
    windows: list[tuple[int, int, str, int]] = []
    for start, end in upper2_windows:
        windows.append((start, end, "resistance_vdo_up_down_0_05", 1))
        if _window_max(features, start, end) <= 0.1:
            windows.append((start, end, "resistance_vdo_up_down_0_05_no_above_0_10", 2))
    for start, end in upper_windows:
        windows.append((start, end, "resistance_vdo_up_down_0_10", 3))
    return windows


def _vdo_cross_windows(features: pd.DataFrame, start_column: str, end_column: str) -> list[tuple[int, int]]:
    if start_column not in features.columns or end_column not in features.columns:
        return []
    windows: list[tuple[int, int]] = []
    active_start: int | None = None
    starts = features[start_column].to_numpy()
    ends = features[end_column].to_numpy()
    for index in range(len(features)):
        if bool(starts[index]):
            active_start = index
        if active_start is not None and index > active_start and bool(ends[index]):
            windows.append((active_start, index))
            active_start = None
    return windows


def _lowest_signal_in_window(candidates: list[tuple[int, StochStateSignal]], start: int, end: int) -> tuple[int, StochStateSignal] | None:
    in_window = [candidate for candidate in candidates if start <= candidate[1].anchor.index <= end]
    if not in_window:
        return None
    return min(in_window, key=lambda candidate: (candidate[1].anchor.price, candidate[1].anchor.index))


def _highest_signal_in_window(candidates: list[tuple[int, StochStateSignal]], start: int, end: int) -> tuple[int, StochStateSignal] | None:
    in_window = [candidate for candidate in candidates if start <= candidate[1].anchor.index <= end]
    if not in_window:
        return None
    return max(in_window, key=lambda candidate: (candidate[1].anchor.price, -candidate[1].anchor.index))


def _window_max(features: pd.DataFrame, start: int, end: int) -> float:
    values = [float(value) for value in features["vdo"].iloc[start:end + 1].tolist() if finite_number(value)]
    return max(values) if values else float("inf")


def _window_min(features: pd.DataFrame, start: int, end: int) -> float:
    values = [float(value) for value in features["vdo"].iloc[start:end + 1].tolist() if finite_number(value)]
    return min(values) if values else float("-inf")


def _classification_priority(reason: str) -> int:
    if reason.endswith("0_10"):
        return 3
    if "no_above" in reason or "no_below" in reason:
        return 2
    return 1


def _create_expected_level_markers(features: pd.DataFrame, signals: list[StochStateSignal], settings: MmfV2Settings) -> list[MmfV2Marker]:
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
            markers.append(_create_marker(signal, settings, ("MMF_V2_EXPECTED_RESISTANCE", "expected_resistance_after_trend_close")))
        if show_support and signal.type == "low" and _is_expected_support(features, signal):
            markers.append(_create_marker(signal, settings, ("MMF_V2_EXPECTED_SUPPORT", "expected_support_after_trend_close")))
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
    return (
        finite_number(morgan_level)
        and signal.anchor.price >= float(morgan_level)
    )


def _is_expected_support(features: pd.DataFrame, signal: StochStateSignal) -> bool:
    if "morgan_center" not in features.columns or "morgan_true_range" not in features.columns:
        return False
    row = features.iloc[signal.anchor.index]
    morgan_level = _expected_support_level(row)
    return (
        finite_number(morgan_level)
        and signal.anchor.price <= float(morgan_level)
    )


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


def _create_trend_retrace_markers(features: pd.DataFrame, signals: list[StochStateSignal], settings: MmfV2Settings) -> list[MmfV2Marker]:
    show_rebound = bool(getattr(settings, "show_trend_down_rebound_point", False))
    show_pullback = bool(getattr(settings, "show_trend_up_pullback_point", False))
    if not show_rebound and not show_pullback:
        return []
    trend_events = _trend_retrace_events(features)
    if not trend_events:
        return []

    markers: list[MmfV2Marker] = []
    for signal in signals:
        trend = _active_trend_at(trend_events, signal.anchor.index)
        if show_rebound and trend == "down" and signal.type == "high":
            markers.append(_create_marker(signal, settings, ("MMF_V2_TREND_DOWN_REBOUND", "trend_down_rebound_after_support_down_break")))
        if show_pullback and trend == "up" and signal.type == "low":
            markers.append(_create_marker(signal, settings, ("MMF_V2_TREND_UP_PULLBACK", "trend_up_pullback_after_resistance_up_break")))
    return markers


def _create_trend_return_markers(features: pd.DataFrame, signals: list[StochStateSignal], settings: MmfV2Settings) -> list[MmfV2Marker]:
    show_down_return = bool(getattr(settings, "show_trend_down_return_point", False))
    show_up_return = bool(getattr(settings, "show_trend_up_return_point", False))
    if not show_down_return and not show_up_return:
        return []
    trend_events = _trend_retrace_events(features)
    if not trend_events:
        return []

    markers: list[MmfV2Marker] = []
    for signal in signals:
        trend = _active_trend_at(trend_events, signal.anchor.index)
        if show_down_return and trend == "down" and signal.type == "high" and _is_trend_down_return(features, signal, settings):
            markers.append(_create_marker(signal, settings, ("MMF_V2_TREND_DOWN_RETURN", "trend_down_return_near_or_above_ma")))
        if show_up_return and trend == "up" and signal.type == "low" and _is_trend_up_return(features, signal, settings):
            markers.append(_create_marker(signal, settings, ("MMF_V2_TREND_UP_RETURN", "trend_up_return_near_or_below_ma")))
    return markers


def _create_trend_divergence_markers(features: pd.DataFrame, signals: list[StochStateSignal], settings: MmfV2Settings) -> list[MmfV2Marker]:
    show_down_divergence = bool(getattr(settings, "show_trend_down_divergence_point", False))
    show_up_divergence = bool(getattr(settings, "show_trend_up_divergence_point", False))
    if not show_down_divergence and not show_up_divergence:
        return []
    return_signal_indexes = _trend_return_signal_indexes(features, signals, settings)

    markers: list[MmfV2Marker] = []
    previous_signal_index: int | None = None
    for signal_index, signal in enumerate(signals):
        if signal.type == "low":
            if (
                show_down_divergence
                and _previous_signal_is_return(signals, previous_signal_index, return_signal_indexes["down"], "high")
                and _is_trend_down_divergence(features, signal, settings)
            ):
                markers.append(_create_marker(signal, settings, ("MMF_V2_TREND_DOWN_DIVERGENCE", "trend_down_divergence_after_return_low_below_morgan")))
            previous_signal_index = signal_index
            continue
        if (
            show_up_divergence
            and _previous_signal_is_return(signals, previous_signal_index, return_signal_indexes["up"], "low")
            and _is_trend_up_divergence(features, signal, settings)
        ):
            markers.append(_create_marker(signal, settings, ("MMF_V2_TREND_UP_DIVERGENCE", "trend_up_divergence_after_return_high_above_morgan")))
        previous_signal_index = signal_index
    return markers


def _previous_signal_is_return(signals: list[StochStateSignal], previous_signal_index: int | None, return_signal_indexes: set[int], expected_type: str) -> bool:
    if previous_signal_index is None or previous_signal_index not in return_signal_indexes:
        return False
    return signals[previous_signal_index].type == expected_type


def _trend_return_signal_indexes(features: pd.DataFrame, signals: list[StochStateSignal], settings: MmfV2Settings) -> dict[str, set[int]]:
    indexes = {"down": set(), "up": set()}
    trend_events = _trend_retrace_events(features)
    if not trend_events:
        return indexes
    for signal_index, signal in enumerate(signals):
        trend = _active_trend_at(trend_events, signal.anchor.index)
        if trend == "down" and signal.type == "high" and _is_trend_down_return(features, signal, settings):
            indexes["down"].add(signal_index)
        if trend == "up" and signal.type == "low" and _is_trend_up_return(features, signal, settings):
            indexes["up"].add(signal_index)
    return indexes


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


def _is_trend_down_return(features: pd.DataFrame, signal: StochStateSignal, settings: MmfV2Settings) -> bool:
    row = features.iloc[signal.anchor.index]
    ma = row.get("ma")
    if not finite_number(ma):
        return False
    marker_price = float(signal.anchor.price)
    if _anchor_bar_touches_ma(features, signal.anchor.index):
        return True
    threshold = _trend_return_threshold(row, getattr(settings, "trend_down_return_morgan_ratio", 0.25))
    return finite_number(threshold) and abs(marker_price - float(ma)) <= float(threshold)


def _is_trend_up_return(features: pd.DataFrame, signal: StochStateSignal, settings: MmfV2Settings) -> bool:
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


def _trend_retrace_events(features: pd.DataFrame) -> list[tuple[int, str | None]]:
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


def _active_trend_at(events: list[tuple[int, str | None]], signal_index: int) -> str | None:
    trend: str | None = None
    for event_index, event_trend in events:
        if event_index >= signal_index:
            break
        trend = event_trend
    return trend


def _create_vdo_break_markers(features: pd.DataFrame, settings: MmfV2Settings) -> list[MmfV2Marker]:
    specs: list[tuple[bool, str, str, str, str]] = [
        (
            bool(getattr(settings, "show_support_down_break_point", False)),
            "vdoCrossDownLower",
            "MMF_V2_SUPPORT_DOWN_BREAK",
            "high",
            "support_vdo_cross_down_neg_0_10",
        ),
        (
            bool(getattr(settings, "show_support_up_break_point", False)),
            "vdoCrossUpLower",
            "MMF_V2_SUPPORT_UP_BREAK",
            "low",
            "support_vdo_cross_up_neg_0_10",
        ),
        (
            bool(getattr(settings, "show_resistance_up_break_point", False)),
            "vdoCrossUpUpper",
            "MMF_V2_RESISTANCE_UP_BREAK",
            "low",
            "resistance_vdo_cross_up_0_10",
        ),
        (
            bool(getattr(settings, "show_resistance_down_break_point", False)),
            "vdoCrossDownUpper",
            "MMF_V2_RESISTANCE_DOWN_BREAK",
            "high",
            "resistance_vdo_cross_down_0_10",
        ),
    ]
    markers: list[MmfV2Marker] = []
    for enabled, column, marker_type, price_column, reason in specs:
        if not enabled or column not in features.columns:
            continue
        values = features[column].to_numpy()
        for index in range(len(features)):
            if bool(values[index]):
                marker = _create_vdo_break_marker(features, index, marker_type, price_column, reason)
                if marker is not None:
                    markers.append(marker)
    return markers


def _create_vdo_break_marker(
    features: pd.DataFrame,
    index: int,
    marker_type: str,
    price_column: str,
    reason: str,
) -> MmfV2Marker | None:
    row = features.iloc[index]
    if not finite_number(row.get(price_column)):
        return None
    time = int(row.get("time"))
    bar_key = str(row.get("barKey") or f"bar:{time}")
    price = float(row.get(price_column))
    return create_mmf_v2_marker(
        type=marker_type,
        event_index=index,
        event_bar_key=bar_key,
        event_time=time,
        confirm_index=index,
        confirm_bar_key=bar_key,
        confirm_time=time,
        marker_index=index,
        marker_bar_key=bar_key,
        marker_time=time,
        marker_price=price,
        entry_index=index,
        entry_bar_key=bar_key,
        entry_time=time,
        entry_price=price,
        point_distance=0.0,
        window_start_index=index,
        window_start_bar_key=bar_key,
        window_start_time=time,
        window_end_index=index,
        window_end_bar_key=bar_key,
        window_end_time=time,
        reason=(reason,),
    )
