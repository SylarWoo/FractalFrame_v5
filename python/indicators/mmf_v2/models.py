from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from python.signals import BarCoordinate, SignalRecord, SignalWindow

MmfV2SignalType = Literal[
    "MMF_V2_HIGH",
    "MMF_V2_LOW",
    "MMF_V2_SUPPORT",
    "MMF_V2_RESISTANCE",
    "MMF_V2_LOW_POSITION_HIGH",
    "MMF_V2_HIGH_POSITION_LOW",
]


@dataclass(frozen=True)
class MmfV2StochSettings:
    length: int = 28
    k_smoothing: int = 6
    d_smoothing: int = 6


@dataclass(frozen=True)
class MmfV2VdoSettings:
    length: int = 14
    ema_smoothing: int = 0
    zero_line_value: float = 0.0
    up_line_value: float = 0.1
    up_line2_value: float = 0.05
    down_line_value: float = -0.1
    down_line2_value: float = -0.05


@dataclass(frozen=True)
class MmfV2MaSettings:
    length: int = 20
    ma_type: str = "sma"
    source: str = "close"


@dataclass(frozen=True)
class MmfV2MorganSettings:
    anchor: str = "h4"
    ratios: tuple[float, ...] = (-0.236, -0.118, 0.118, 0.236)


@dataclass(frozen=True)
class MmfV2SignalSettings:
    enabled: bool = False


@dataclass(frozen=True)
class MmfV2Settings:
    show_high: bool = True
    show_low: bool = True
    show_support_level: bool = False
    show_resistance_level: bool = False
    high_anchor_lookback_bars: int = 14
    low_anchor_lookback_bars: int = 14
    high_stoch_k_advance: float = 10
    low_stoch_k_advance: float = 10
    high_confirm_lookahead_bars: int = 7
    low_confirm_lookahead_bars: int = 7
    stoch: MmfV2StochSettings = field(default_factory=MmfV2StochSettings)
    vdo: MmfV2VdoSettings = field(default_factory=MmfV2VdoSettings)
    ma: MmfV2MaSettings = field(default_factory=MmfV2MaSettings)
    morgan: MmfV2MorganSettings = field(default_factory=MmfV2MorganSettings)
    signals: dict[str, MmfV2SignalSettings] = field(default_factory=dict)


MmfV2Marker = SignalRecord


def create_mmf_v2_marker(
    *,
    type: MmfV2SignalType,
    event_index: int,
    event_bar_key: str,
    event_time: int,
    confirm_index: int,
    confirm_bar_key: str,
    confirm_time: int,
    marker_index: int,
    marker_bar_key: str,
    marker_time: int,
    marker_price: float,
    entry_index: int,
    entry_bar_key: str,
    entry_time: int,
    entry_price: float,
    point_distance: float,
    window_start_index: int,
    window_start_bar_key: str,
    window_start_time: int,
    window_end_index: int,
    window_end_bar_key: str,
    window_end_time: int,
    reason: tuple[str, ...] = (),
) -> SignalRecord:
    return SignalRecord(
        indicator="MMF_V2",
        type=type,
        event=BarCoordinate(event_index, event_bar_key, event_time),
        confirm=BarCoordinate(confirm_index, confirm_bar_key, confirm_time),
        marker=BarCoordinate(marker_index, marker_bar_key, marker_time, marker_price),
        entry=BarCoordinate(entry_index, entry_bar_key, entry_time, entry_price),
        window=SignalWindow(
            start=BarCoordinate(window_start_index, window_start_bar_key, window_start_time),
            end=BarCoordinate(window_end_index, window_end_bar_key, window_end_time),
        ),
        metrics={"pointDistance": point_distance},
        reason=reason,
    )
