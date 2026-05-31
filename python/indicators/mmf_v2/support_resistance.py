from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
import pandas as pd

from .features import finite_number
from .models import MmfV2Settings
from .stoch_state_machine import StochStateSignal

LevelSide = Literal["resistance", "support"]
WindowEndSource = Literal["vdo_level", "vmi_zero"]


@dataclass(frozen=True)
class VdoLevelRule:
    side: LevelSide
    level: float
    boundary: float | None
    rank: int


@dataclass(frozen=True)
class VdoLevelWindow:
    side: LevelSide
    level: float
    rank: int
    vdo_start: int
    vdo_end: int
    end_source: WindowEndSource
    region_start: int
    region_end: int
    reason: str


RESISTANCE_RULES: tuple[VdoLevelRule, ...] = (
    VdoLevelRule("resistance", -0.16, -0.10, 1),
    VdoLevelRule("resistance", -0.10, -0.05, 2),
    VdoLevelRule("resistance", -0.05, 0.00, 3),
    VdoLevelRule("resistance", 0.00, 0.05, 4),
    VdoLevelRule("resistance", 0.05, 0.10, 5),
    VdoLevelRule("resistance", 0.10, 0.16, 6),
    VdoLevelRule("resistance", 0.16, None, 7),
)

SUPPORT_RULES: tuple[VdoLevelRule, ...] = (
    VdoLevelRule("support", 0.16, 0.10, 1),
    VdoLevelRule("support", 0.10, 0.05, 2),
    VdoLevelRule("support", 0.05, 0.00, 3),
    VdoLevelRule("support", 0.00, -0.05, 4),
    VdoLevelRule("support", -0.05, -0.10, 5),
    VdoLevelRule("support", -0.10, -0.16, 6),
    VdoLevelRule("support", -0.16, None, 7),
)


def classify_vdo_levels(features: pd.DataFrame, signals: list[StochStateSignal], settings: MmfV2Settings) -> dict[int, tuple[str, str]]:
    classifications: dict[int, tuple[str, str]] = {}
    if bool(getattr(settings, "show_support_level", False)):
        classifications.update(_classify_support_levels(features, signals))
    if bool(getattr(settings, "show_resistance_level", False)):
        classifications.update(_classify_resistance_levels(features, signals))
    return classifications


def create_vdo_level_debug(features: pd.DataFrame, signals: list[StochStateSignal]) -> dict[str, list[dict[str, object]]]:
    return {
        "support": _debug_level_side(features, signals, SUPPORT_RULES, "low"),
        "resistance": _debug_level_side(features, signals, RESISTANCE_RULES, "high"),
    }


def _classify_support_levels(features: pd.DataFrame, signals: list[StochStateSignal]) -> dict[int, tuple[str, str]]:
    candidates = [(index, signal) for index, signal in enumerate(signals) if signal.type == "low"]
    if not candidates:
        return {}

    classifications: dict[int, tuple[str, str]] = {}
    for window in _support_vdo_windows(features):
        vdo_candidate = _lowest_signal_in_window(candidates, window.vdo_start, window.vdo_end)
        if vdo_candidate is not None:
            _apply_classification(classifications, vdo_candidate[0], "MMF_V2_SUPPORT", window, _window_reason(window, "vdo_window"))
            continue
        region_candidate = _lowest_signal_in_window(candidates, window.region_start, window.region_end)
        if region_candidate is not None:
            _apply_classification(classifications, region_candidate[0], "MMF_V2_SUPPORT", window, _window_reason(window, "vmi_region"))
    return classifications


def _debug_level_side(
    features: pd.DataFrame,
    signals: list[StochStateSignal],
    rules: tuple[VdoLevelRule, ...],
    signal_type: Literal["high", "low"],
) -> list[dict[str, object]]:
    candidates = [(index, signal) for index, signal in enumerate(signals) if signal.type == signal_type]
    rows: list[dict[str, object]] = []
    for rule in rules:
        for start, end, end_source in _vdo_cross_windows(features, rule):
            row: dict[str, object] = {
                "side": rule.side,
                "rank": rule.rank,
                "level": rule.level,
                "boundary": rule.boundary,
                "vdoStart": start,
                "vdoEnd": end,
                "rightSource": end_source,
                "middleBoundaryOk": False,
                "vmiRegionOk": False,
                "status": "middle_boundary_failed",
            }
            if not _passes_middle_boundary(features, start, end, rule):
                rows.append(row)
                continue

            row["middleBoundaryOk"] = True
            region = _vmi_zero_region(features, start, end, rule.side, end_source)
            if region is None:
                row["status"] = "vmi_region_missing"
                rows.append(row)
                continue

            region_start, region_end = region
            in_vdo = [candidate for candidate in candidates if start <= candidate[1].anchor.index <= end]
            in_region = [candidate for candidate in candidates if region_start <= candidate[1].anchor.index <= region_end]
            vdo_selected = _highest_signal_in_window(candidates, start, end) if signal_type == "high" else _lowest_signal_in_window(candidates, start, end)
            region_selected = _highest_signal_in_window(candidates, region_start, region_end) if signal_type == "high" else _lowest_signal_in_window(candidates, region_start, region_end)
            selected = vdo_selected or region_selected
            selected_source = "vdo_window" if vdo_selected else "vmi_region"
            row.update({
                "candidateCount": len(in_vdo) if vdo_selected else len(in_region),
                "selectedSource": selected_source if selected else None,
                "selectedAnchorIndex": selected[1].anchor.index if selected else None,
                "selectedSignalIndex": selected[0] if selected else None,
                "selectedPrice": selected[1].anchor.price if selected else None,
                "status": "ok" if selected else "stoch_candidate_missing",
                "vdoCandidateCount": len(in_vdo),
                "vmiRegionEnd": region_end,
                "vmiRegionOk": True,
                "vmiRegionStart": region_start,
                "vmiCandidateCount": len(in_region),
            })
            rows.append(row)
    return rows


def _classify_resistance_levels(features: pd.DataFrame, signals: list[StochStateSignal]) -> dict[int, tuple[str, str]]:
    candidates = [(index, signal) for index, signal in enumerate(signals) if signal.type == "high"]
    if not candidates:
        return {}

    classifications: dict[int, tuple[str, str]] = {}
    for window in _resistance_vdo_windows(features):
        vdo_candidate = _highest_signal_in_window(candidates, window.vdo_start, window.vdo_end)
        if vdo_candidate is not None:
            _apply_classification(classifications, vdo_candidate[0], "MMF_V2_RESISTANCE", window, _window_reason(window, "vdo_window"))
            continue
        region_candidate = _highest_signal_in_window(candidates, window.region_start, window.region_end)
        if region_candidate is not None:
            _apply_classification(classifications, region_candidate[0], "MMF_V2_RESISTANCE", window, _window_reason(window, "vmi_region"))
    return classifications


def _apply_classification(
    classifications: dict[int, tuple[str, str]],
    signal_index: int,
    marker_type: str,
    window: VdoLevelWindow,
    reason: str,
) -> None:
    current = classifications.get(signal_index)
    if current is not None and _classification_priority(current[1]) >= window.rank:
        return
    classifications[signal_index] = (marker_type, reason)


def _support_vdo_windows(features: pd.DataFrame) -> list[VdoLevelWindow]:
    return _vdo_level_windows(features, SUPPORT_RULES)


def _resistance_vdo_windows(features: pd.DataFrame) -> list[VdoLevelWindow]:
    return _vdo_level_windows(features, RESISTANCE_RULES)


def _vdo_level_windows(features: pd.DataFrame, rules: tuple[VdoLevelRule, ...]) -> list[VdoLevelWindow]:
    if "vdo" not in features.columns:
        return []

    values = pd.to_numeric(features["vdo"], errors="coerce").to_numpy(dtype=float)
    vmi_up_left = _nearest_true_left_array(features["vmiCrossUpZero"].to_numpy() if "vmiCrossUpZero" in features.columns else None, len(values))
    vmi_down_left = _nearest_true_left_array(features["vmiCrossDownZero"].to_numpy() if "vmiCrossDownZero" in features.columns else None, len(values))
    windows: list[VdoLevelWindow] = []
    for rule in rules:
        fallback_values = None
        if rule.side == "resistance" and "vmiCrossDownZero" in features.columns:
            fallback_values = features["vmiCrossDownZero"].to_numpy()
        if rule.side == "support" and "vmiCrossUpZero" in features.columns:
            fallback_values = features["vmiCrossUpZero"].to_numpy()
        for start, end, end_source in _vdo_cross_windows_from_arrays(values, fallback_values, rule):
            if not _passes_middle_boundary_array(values, start, end, rule):
                continue
            region = _vmi_zero_region_from_arrays(start, end, rule.side, end_source, vmi_up_left, vmi_down_left)
            if region is None:
                continue
            region_start, region_end = region
            windows.append(VdoLevelWindow(
                side=rule.side,
                level=rule.level,
                rank=rule.rank,
                vdo_start=start,
                vdo_end=end,
                end_source=end_source,
                region_start=region_start,
                region_end=region_end,
                reason=_base_window_reason(rule, start, end, region_start, region_end),
            ))
    return windows


def _nearest_true_left_array(values: np.ndarray | None, length: int) -> np.ndarray:
    out = np.full(length, -1, dtype=np.int64)
    if values is None:
        return out
    last = -1
    for index in range(length):
        if bool(values[index]):
            last = index
        out[index] = last
    return out


def _vdo_cross_windows_from_arrays(
    values: np.ndarray,
    fallback_values: np.ndarray | None,
    rule: VdoLevelRule,
) -> list[tuple[int, int, WindowEndSource]]:
    windows: list[tuple[int, int, WindowEndSource]] = []
    active_start: int | None = None
    for index in range(1, len(values)):
        previous = values[index - 1]
        current = values[index]
        if not (np.isfinite(previous) and np.isfinite(current)):
            continue

        if rule.side == "resistance":
            if float(previous) < rule.level <= float(current):
                active_start = index
            if active_start is not None and index > active_start and float(previous) > rule.level >= float(current):
                windows.append((active_start, index, "vdo_level"))
                active_start = None
                continue
            if active_start is not None and index > active_start and fallback_values is not None and bool(fallback_values[index]):
                windows.append((active_start, index, "vmi_zero"))
                active_start = None
            continue

        if float(previous) > rule.level >= float(current):
            active_start = index
        if active_start is not None and index > active_start and float(previous) < rule.level <= float(current):
            windows.append((active_start, index, "vdo_level"))
            active_start = None
            continue
        if active_start is not None and index > active_start and fallback_values is not None and bool(fallback_values[index]):
            windows.append((active_start, index, "vmi_zero"))
            active_start = None
    return windows


def _passes_middle_boundary_array(values: np.ndarray, start: int, end: int, rule: VdoLevelRule) -> bool:
    if rule.boundary is None:
        return True
    window = values[start:end + 1]
    finite = window[np.isfinite(window)]
    if finite.size == 0:
        return False
    if rule.side == "resistance":
        return float(np.max(finite)) <= rule.boundary
    return float(np.min(finite)) >= rule.boundary


def _vmi_zero_region_from_arrays(
    start: int,
    end: int,
    side: LevelSide,
    end_source: WindowEndSource,
    vmi_up_left: np.ndarray,
    vmi_down_left: np.ndarray,
) -> tuple[int, int] | None:
    safe_start = max(0, min(start, len(vmi_up_left) - 1))
    safe_end = max(0, min(end, len(vmi_up_left) - 1))
    if side == "resistance":
        left = int(vmi_up_left[safe_start])
        right = int(vmi_down_left[safe_end])
    else:
        left = int(vmi_down_left[safe_start])
        right = int(vmi_up_left[safe_end])
    if left < 0:
        return None
    if end_source == "vdo_level" and (right < 0 or right <= left):
        right = end
    if right < 0 or right <= left:
        return None
    return left, right


def _vdo_cross_windows(features: pd.DataFrame, rule: VdoLevelRule) -> list[tuple[int, int, WindowEndSource]]:
    values = features["vdo"].to_numpy()
    fallback_column = "vmiCrossDownZero" if rule.side == "resistance" else "vmiCrossUpZero"
    fallback_values = features[fallback_column].to_numpy() if fallback_column in features.columns else None
    windows: list[tuple[int, int, WindowEndSource]] = []
    active_start: int | None = None

    for index in range(1, len(values)):
        previous = values[index - 1]
        current = values[index]
        if not finite_number(previous) or not finite_number(current):
            continue

        if rule.side == "resistance":
            if float(previous) < rule.level <= float(current):
                active_start = index
            if active_start is not None and index > active_start and float(previous) > rule.level >= float(current):
                windows.append((active_start, index, "vdo_level"))
                active_start = None
                continue
            if active_start is not None and index > active_start and fallback_values is not None and bool(fallback_values[index]):
                windows.append((active_start, index, "vmi_zero"))
                active_start = None
            continue

        if float(previous) > rule.level >= float(current):
            active_start = index
        if active_start is not None and index > active_start and float(previous) < rule.level <= float(current):
            windows.append((active_start, index, "vdo_level"))
            active_start = None
            continue
        if active_start is not None and index > active_start and fallback_values is not None and bool(fallback_values[index]):
            windows.append((active_start, index, "vmi_zero"))
            active_start = None

    return windows


def _passes_middle_boundary(features: pd.DataFrame, start: int, end: int, rule: VdoLevelRule) -> bool:
    if rule.boundary is None:
        return True
    if rule.side == "resistance":
        return _window_max(features, start, end) <= rule.boundary
    return _window_min(features, start, end) >= rule.boundary


def _vmi_zero_region(features: pd.DataFrame, start: int, end: int, side: LevelSide, end_source: WindowEndSource) -> tuple[int, int] | None:
    if side == "resistance":
        left = _nearest_cross_left(features, "vmiCrossUpZero", start)
        right = _nearest_cross_left(features, "vmiCrossDownZero", end)
    else:
        left = _nearest_cross_left(features, "vmiCrossDownZero", start)
        right = _nearest_cross_left(features, "vmiCrossUpZero", end)
    if left is None:
        return None
    if end_source == "vdo_level" and (right is None or right <= left):
        right = end
    if right is None or right <= left:
        return None
    return left, right


def _nearest_cross_left(features: pd.DataFrame, column: str, index: int) -> int | None:
    if column not in features.columns:
        return None
    values = features[column].to_numpy()
    for cursor in range(min(index, len(values) - 1), -1, -1):
        if bool(values[cursor]):
            return cursor
    return None


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


def _base_window_reason(rule: VdoLevelRule, start: int, end: int, region_start: int, region_end: int) -> str:
    level = _format_level(rule.level)
    boundary = "open" if rule.boundary is None else _format_level(rule.boundary)
    prefix = "resistance" if rule.side == "resistance" else "support"
    return f"{prefix}_vdo_level_{rule.rank}_{level}_boundary_{boundary}_vmi_region_{region_start}_{region_end}_vdo_window_{start}_{end}"


def _window_reason(window: VdoLevelWindow, source: Literal["vdo_window", "vmi_region"]) -> str:
    return f"{window.reason}_right_{window.end_source}_source_{source}"


def _format_level(value: float) -> str:
    text = f"{value:.2f}".replace("-", "neg_").replace(".", "_")
    return text.replace("neg_0_00", "0_00")


def _classification_priority(reason: str) -> int:
    marker = "_level_"
    if marker not in reason:
        return 0
    try:
        return int(reason.split(marker, 1)[1].split("_", 1)[0])
    except (IndexError, ValueError):
        return 0
