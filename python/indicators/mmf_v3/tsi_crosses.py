from __future__ import annotations

import pandas as pd

from .features import finite_number
from .models import MmfV3Marker, MmfV3Settings, create_mmf_v3_marker


def create_tsi_cross_markers(features: pd.DataFrame, settings: MmfV3Settings) -> list[MmfV3Marker]:
    markers: list[MmfV3Marker] = []
    if bool(getattr(settings, "show_tsi_dead_cross_point", False)) or bool(getattr(settings, "show_tsi_dead_cross_confirm_point", False)):
        markers.extend(_create_side_markers(
            features,
            cross_column="tsiCrossDownSignal",
            opposite_column="tsiCrossUpSignal",
            cross_type="MMF_V3_TSI_DEAD_CROSS",
            confirm_type="MMF_V3_TSI_DEAD_CROSS_CONFIRM",
            price_column="high",
            reason_prefix="tsi_dead_cross",
            confirm_distance=max(0.0, float(getattr(settings, "tsi_dead_cross_confirm_distance", 5.0))),
            show_cross=bool(getattr(settings, "show_tsi_dead_cross_point", False)),
            show_confirm=bool(getattr(settings, "show_tsi_dead_cross_confirm_point", False)),
            sign=-1,
        ))
    if bool(getattr(settings, "show_tsi_golden_cross_point", False)) or bool(getattr(settings, "show_tsi_golden_cross_confirm_point", False)):
        markers.extend(_create_side_markers(
            features,
            cross_column="tsiCrossUpSignal",
            opposite_column="tsiCrossDownSignal",
            cross_type="MMF_V3_TSI_GOLDEN_CROSS",
            confirm_type="MMF_V3_TSI_GOLDEN_CROSS_CONFIRM",
            price_column="low",
            reason_prefix="tsi_golden_cross",
            confirm_distance=max(0.0, float(getattr(settings, "tsi_golden_cross_confirm_distance", 5.0))),
            show_cross=bool(getattr(settings, "show_tsi_golden_cross_point", False)),
            show_confirm=bool(getattr(settings, "show_tsi_golden_cross_confirm_point", False)),
            sign=1,
        ))
    return markers


def _create_side_markers(
    features: pd.DataFrame,
    *,
    cross_column: str,
    opposite_column: str,
    cross_type: str,
    confirm_type: str,
    price_column: str,
    reason_prefix: str,
    confirm_distance: float,
    show_cross: bool,
    show_confirm: bool,
    sign: int,
) -> list[MmfV3Marker]:
    if cross_column not in features.columns:
        return []
    markers: list[MmfV3Marker] = []
    for cross_index, value in enumerate(features[cross_column].to_numpy()):
        if not bool(value):
            continue
        confirm_index = _find_confirm_index(features, cross_index, opposite_column, sign, confirm_distance)
        if confirm_index is None:
            continue
        if show_cross:
            marker = _create_marker(features, cross_index, cross_index, cross_type, price_column, f"{reason_prefix}_cross")
            if marker is not None:
                markers.append(marker)
        if show_confirm:
            marker = _create_marker(features, cross_index, confirm_index, confirm_type, price_column, f"{reason_prefix}_confirm_distance_{confirm_distance:g}")
            if marker is not None:
                markers.append(marker)
    return markers


def _find_confirm_index(features: pd.DataFrame, cross_index: int, opposite_column: str, sign: int, confirm_distance: float) -> int | None:
    if "tsiHistogram" not in features.columns:
        return None
    hist = pd.to_numeric(features["tsiHistogram"], errors="coerce")
    opposite = features[opposite_column].to_numpy() if opposite_column in features.columns else None
    for index in range(cross_index, len(features)):
        if index > cross_index and opposite is not None and bool(opposite[index]):
            return None
        value = hist.iloc[index]
        if finite_number(value) and float(value) * sign >= confirm_distance:
            return index
    return None


def _create_marker(features: pd.DataFrame, cross_index: int, marker_index: int, marker_type: str, price_column: str, reason: str) -> MmfV3Marker | None:
    if "time" not in features.columns or price_column not in features.columns:
        return None
    price = pd.to_numeric(features[price_column].iloc[marker_index], errors="coerce")
    if not finite_number(price):
        return None
    times = features["time"].to_numpy()
    bar_keys = features["barKey"].to_numpy() if "barKey" in features.columns else None
    event_time = int(times[cross_index])
    marker_time = int(times[marker_index])
    event_bar_key = str(bar_keys[cross_index]) if bar_keys is not None else f"bar:{event_time}"
    marker_bar_key = str(bar_keys[marker_index]) if bar_keys is not None else f"bar:{marker_time}"
    marker_price = float(price)
    return create_mmf_v3_marker(
        type=marker_type,  # type: ignore[arg-type]
        event_index=cross_index,
        event_bar_key=event_bar_key,
        event_time=event_time,
        confirm_index=marker_index,
        confirm_bar_key=marker_bar_key,
        confirm_time=marker_time,
        marker_index=marker_index,
        marker_bar_key=marker_bar_key,
        marker_time=marker_time,
        marker_price=marker_price,
        entry_index=marker_index,
        entry_bar_key=marker_bar_key,
        entry_time=marker_time,
        entry_price=marker_price,
        point_distance=0.0,
        window_start_index=cross_index,
        window_start_bar_key=event_bar_key,
        window_start_time=event_time,
        window_end_index=marker_index,
        window_end_bar_key=marker_bar_key,
        window_end_time=marker_time,
        reason=(reason,),
    )
