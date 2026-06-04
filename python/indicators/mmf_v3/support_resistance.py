from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
import pandas as pd

from .features import finite_number
from .models import MmfV3Settings
from .stoch_state_machine import StochStateSignal

LevelSide = Literal["resistance", "support"]


@dataclass(frozen=True)
class VmiZeroWindow:
    side: LevelSide
    start: int
    end: int
    reason: str


def classify_vmi_zero_levels(features: pd.DataFrame, signals: list[StochStateSignal], settings: MmfV3Settings) -> dict[int, tuple[str, str]]:
    """MMF_V3 support/resistance uses only VMI zero-axis windows.

    The function name stays stable because signal_decision already calls it.
    V2 still keeps the old VDO tier algorithm; V3 is isolated here.
    """
    classifications: dict[int, tuple[str, str]] = {}
    if bool(getattr(settings, "show_support_level", False)):
        classifications.update(_classify_support_levels(features, signals))
    if bool(getattr(settings, "show_resistance_level", False)):
        classifications.update(_classify_resistance_levels(features, signals))
    return classifications


def create_vmi_zero_level_debug(features: pd.DataFrame, signals: list[StochStateSignal], settings: MmfV3Settings | None = None) -> dict[str, list[dict[str, object]]]:
    return {
        "support": _debug_level_side(features, signals, "support", "low"),
        "resistance": _debug_level_side(features, signals, "resistance", "high"),
    }


def _classify_support_levels(features: pd.DataFrame, signals: list[StochStateSignal]) -> dict[int, tuple[str, str]]:
    candidates = [(index, signal) for index, signal in enumerate(signals) if signal.type == "low"]
    classifications: dict[int, tuple[str, str]] = {}
    for window in _vmi_zero_windows(features, "support"):
        selected = _lowest_signal_in_window(candidates, window.start, window.end)
        if selected is not None:
            classifications[selected[0]] = ("MMF_V3_SUPPORT", window.reason)
    return classifications


def _classify_resistance_levels(features: pd.DataFrame, signals: list[StochStateSignal]) -> dict[int, tuple[str, str]]:
    candidates = [(index, signal) for index, signal in enumerate(signals) if signal.type == "high"]
    classifications: dict[int, tuple[str, str]] = {}
    for window in _vmi_zero_windows(features, "resistance"):
        selected = _highest_signal_in_window(candidates, window.start, window.end)
        if selected is not None:
            classifications[selected[0]] = ("MMF_V3_RESISTANCE", window.reason)
    return classifications


def _debug_level_side(
    features: pd.DataFrame,
    signals: list[StochStateSignal],
    side: LevelSide,
    signal_type: Literal["high", "low"],
) -> list[dict[str, object]]:
    candidates = [(index, signal) for index, signal in enumerate(signals) if signal.type == signal_type]
    rows: list[dict[str, object]] = []
    for window in _vmi_zero_windows(features, side):
        in_window = [candidate for candidate in candidates if window.start <= candidate[1].anchor.index <= window.end]
        selected = _highest_signal_in_window(candidates, window.start, window.end) if signal_type == "high" else _lowest_signal_in_window(candidates, window.start, window.end)
        rows.append({
            "side": side,
            "vmiRegionStart": window.start,
            "vmiRegionEnd": window.end,
            "vmiRegionOk": True,
            "candidateCount": len(in_window),
            "selectedSignalIndex": selected[0] if selected else None,
            "selectedAnchorIndex": selected[1].anchor.index if selected else None,
            "selectedPrice": selected[1].anchor.price if selected else None,
            "selectedSource": "vmi_zero_window" if selected else None,
            "status": "ok" if selected else "stoch_candidate_missing",
        })
    return rows


def _vmi_zero_windows(features: pd.DataFrame, side: LevelSide) -> list[VmiZeroWindow]:
    length = len(features)
    if length <= 1:
        return []

    values = _vmi_values(features, length)
    if len(values) != length:
        return []

    cross_up, cross_down = _vmi_zero_cross_arrays(values)
    windows: list[VmiZeroWindow] = []
    active_start: int | None = None

    for index in range(1, length):
        if side == "support":
            if bool(cross_down[index]):
                active_start = index
                continue
            if active_start is not None and index > active_start and bool(cross_up[index]):
                windows.append(VmiZeroWindow(
                    side=side,
                    start=active_start,
                    end=index,
                    reason=f"support_vmi_cross_down_zero_{active_start}_to_cross_up_zero_{index}",
                ))
                active_start = None
            continue

        if bool(cross_up[index]):
            active_start = index
            continue
        if active_start is not None and index > active_start and bool(cross_down[index]):
            windows.append(VmiZeroWindow(
                side=side,
                start=active_start,
                end=index,
                reason=f"resistance_vmi_cross_up_zero_{active_start}_to_cross_down_zero_{index}",
            ))
            active_start = None

    return windows


def _vmi_values(features: pd.DataFrame, length: int) -> np.ndarray:
    values = pd.to_numeric(features["vmiHistogram"] if "vmiHistogram" in features.columns else pd.Series([], dtype=float), errors="coerce").to_numpy(dtype=float)
    return values if len(values) == length else np.array([], dtype=float)


def _vmi_zero_cross_arrays(values: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    length = len(values)
    cross_up = np.zeros(length, dtype=bool)
    cross_down = np.zeros(length, dtype=bool)
    for index in range(1, length):
        previous = values[index - 1]
        current = values[index]
        if not (finite_number(previous) and finite_number(current)):
            continue
        previous_value = float(previous)
        current_value = float(current)
        cross_up[index] = previous_value <= 0 < current_value
        cross_down[index] = previous_value >= 0 > current_value
    return cross_up, cross_down


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
