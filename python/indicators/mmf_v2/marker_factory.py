from __future__ import annotations

from .models import MmfV2Marker, MmfV2Settings, create_mmf_v2_marker
from .stoch_state_machine import StochStateSignal


def create_marker(signal: StochStateSignal, settings: MmfV2Settings, classification: tuple[str, str] | None = None) -> MmfV2Marker:
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
