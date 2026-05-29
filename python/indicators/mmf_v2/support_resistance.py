from __future__ import annotations

import pandas as pd

from .features import finite_number
from .models import MmfV2Settings
from .stoch_state_machine import StochStateSignal


def classify_vdo_levels(features: pd.DataFrame, signals: list[StochStateSignal], settings: MmfV2Settings) -> dict[int, tuple[str, str]]:
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
