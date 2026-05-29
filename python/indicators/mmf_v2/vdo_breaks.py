from __future__ import annotations

import pandas as pd

from .features import finite_number
from .models import MmfV2Marker, MmfV2Settings, create_mmf_v2_marker


def create_vdo_break_markers(features: pd.DataFrame, settings: MmfV2Settings) -> list[MmfV2Marker]:
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
