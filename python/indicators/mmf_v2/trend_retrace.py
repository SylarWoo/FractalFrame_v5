from __future__ import annotations

import pandas as pd

from .features import finite_number
from .marker_factory import create_marker
from .models import MmfV2Marker, MmfV2Settings
from .stoch_state_machine import StochStateSignal


def create_trend_retrace_markers(
    features: pd.DataFrame,
    signals: list[StochStateSignal],
    settings: MmfV2Settings,
    classifications: dict[int, tuple[str, str]] | None = None,
) -> list[MmfV2Marker]:
    show_rebound = bool(getattr(settings, "show_trend_down_rebound_point", False))
    show_pullback = bool(getattr(settings, "show_trend_up_pullback_point", False))
    if not show_rebound and not show_pullback:
        return []

    active_classifications = classifications or {}
    markers: list[MmfV2Marker] = []
    for signal_index, signal in enumerate(signals):
        marker_type = active_classifications.get(signal_index, (_base_marker_type(signal), ""))[0]
        anchor_index = signal.anchor.index

        if (
            show_rebound
            and signal.type == "high"
            and marker_type in {"MMF_V2_HIGH", "MMF_V2_RESISTANCE"}
            and _bool_feature(features, "vdoBearMarketActive", anchor_index)
            and _bool_feature(features, "vdoOversoldActive", anchor_index)
            and _number_feature(features, "vmiHistogram", anchor_index) > 0
        ):
            markers.append(create_marker(
                signal,
                settings,
                ("MMF_V2_TREND_DOWN_REBOUND", "trend_down_rebound_oversold_active_high_or_resistance_positive_vmi"),
            ))

        if (
            show_pullback
            and signal.type == "low"
            and marker_type in {"MMF_V2_LOW", "MMF_V2_SUPPORT"}
            and _bool_feature(features, "vdoBullMarketActive", anchor_index)
            and _bool_feature(features, "vdoOverboughtActive", anchor_index)
            and _number_feature(features, "vmiHistogram", anchor_index) < 0
        ):
            markers.append(create_marker(
                signal,
                settings,
                ("MMF_V2_TREND_UP_PULLBACK", "trend_up_pullback_overbought_active_low_or_support_negative_vmi"),
            ))

    return markers


def _base_marker_type(signal: StochStateSignal) -> str:
    return "MMF_V2_HIGH" if signal.type == "high" else "MMF_V2_LOW"


def _bool_feature(features: pd.DataFrame, column: str, index: int) -> bool:
    if column not in features.columns or index < 0 or index >= len(features):
        return False
    return bool(features[column].iloc[index])


def _number_feature(features: pd.DataFrame, column: str, index: int) -> float:
    if column not in features.columns or index < 0 or index >= len(features):
        return 0.0
    value = pd.to_numeric(features[column].iloc[index], errors="coerce")
    return float(value) if finite_number(value) else 0.0
