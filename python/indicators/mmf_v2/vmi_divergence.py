from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import pandas as pd

from .models import MmfV2Settings
from .stoch_state_machine import StochStateSignal


@dataclass(frozen=True)
class _DivergencePoint:
    signal_index: int
    signal: StochStateSignal
    marker_type: str
    price: float
    vmi: float
    epoch: int


def apply_vmi_divergence_classifications(
    features: pd.DataFrame,
    signals: list[StochStateSignal],
    settings: MmfV2Settings,
    classifications: dict[int, tuple[str, str]],
) -> dict[int, tuple[str, str]]:
    if not signals:
        return classifications

    updated = dict(classifications)
    if bool(getattr(settings, "show_top_divergence_point", False)):
        _apply_side_divergence(
            features=features,
            signals=signals,
            classifications=updated,
            signal_side="high",
            base_type="MMF_V2_RESISTANCE",
            divergence_type="MMF_V2_TOP_DIVERGENCE",
            epoch_column="vdoOverboughtEpoch",
            active_column="vdoOverboughtActive",
            price_makes_divergence=lambda current, base: current > base,
            vmi_makes_divergence=lambda current, base: current < base,
            reason_prefix="top_divergence",
        )
    if bool(getattr(settings, "show_bottom_divergence_point", False)):
        _apply_side_divergence(
            features=features,
            signals=signals,
            classifications=updated,
            signal_side="low",
            base_type="MMF_V2_SUPPORT",
            divergence_type="MMF_V2_BOTTOM_DIVERGENCE",
            epoch_column="vdoOversoldEpoch",
            active_column="vdoOversoldActive",
            price_makes_divergence=lambda current, base: current < base,
            vmi_makes_divergence=lambda current, base: current > base,
            reason_prefix="bottom_divergence",
        )
    return updated


def _apply_side_divergence(
    *,
    features: pd.DataFrame,
    signals: list[StochStateSignal],
    classifications: dict[int, tuple[str, str]],
    signal_side: str,
    base_type: str,
    divergence_type: str,
    epoch_column: str,
    active_column: str,
    price_makes_divergence: Callable[[float, float], bool],
    vmi_makes_divergence: Callable[[float, float], bool],
    reason_prefix: str,
) -> None:
    if "vmiHistogram" not in features.columns or epoch_column not in features.columns or active_column not in features.columns:
        return

    points = _collect_side_points(features, signals, classifications, signal_side, epoch_column, active_column)
    base_by_epoch: dict[int, _DivergencePoint] = {}
    for point in points:
        base = base_by_epoch.get(point.epoch)
        if base is not None and price_makes_divergence(point.price, base.price) and vmi_makes_divergence(point.vmi, base.vmi):
            classifications[point.signal_index] = (
                divergence_type,
                (
                    f"{reason_prefix}_epoch_{point.epoch}"
                    f"_compare_base_{base.signal.anchor.index}"
                    f"_candidate_{point.signal.anchor.index}"
                    f"_price_{point.price:.6g}_vs_{base.price:.6g}"
                    f"_vmi_{point.vmi:.6g}_vs_{base.vmi:.6g}"
                ),
            )

        if point.marker_type == base_type:
            base_by_epoch[point.epoch] = point


def _collect_side_points(
    features: pd.DataFrame,
    signals: list[StochStateSignal],
    classifications: dict[int, tuple[str, str]],
    signal_side: str,
    epoch_column: str,
    active_column: str,
) -> list[_DivergencePoint]:
    points: list[_DivergencePoint] = []
    for signal_index, signal in enumerate(signals):
        if signal.type != signal_side:
            continue
        index = int(signal.anchor.index)
        if index < 0 or index >= len(features):
            continue
        row = features.iloc[index]
        if not bool(row.get(active_column, False)):
            continue
        epoch = _safe_int(row.get(epoch_column))
        price = _safe_float(signal.anchor.price)
        vmi = _safe_float(row.get("vmiHistogram"))
        if epoch is None or price is None or vmi is None:
            continue
        marker_type = classifications.get(signal_index, ("MMF_V2_HIGH" if signal_side == "high" else "MMF_V2_LOW", ""))[0]
        points.append(_DivergencePoint(
            signal_index=signal_index,
            signal=signal,
            marker_type=marker_type,
            price=price,
            vmi=vmi,
            epoch=epoch,
        ))
    return sorted(points, key=lambda point: (point.signal.anchor.index, point.signal_index))


def _safe_float(value: object) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number else None


def _safe_int(value: object) -> int | None:
    number = _safe_float(value)
    if number is None:
        return None
    return int(number)
