from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from python.indicators.vmi import VmiSettings
from python.indicators.vdo import VdoSettings
from python.indicators.tsi import TsiSettings
from python.indicators.vwap import VwapSettings
from python.signals import BarCoordinate, SignalRecord, SignalWindow

MmfV3SignalType = Literal[
    "MMF_V3_HIGH",
    "MMF_V3_LOW",
    "MMF_V3_SUPPORT",
    "MMF_V3_RESISTANCE",
    "MMF_V3_TOP_DIVERGENCE",
    "MMF_V3_BOTTOM_DIVERGENCE",
    "MMF_V3_EXPECTED_SUPPORT",
    "MMF_V3_EXPECTED_RESISTANCE",
    "MMF_V3_TREND_DOWN_REBOUND",
    "MMF_V3_TREND_UP_PULLBACK",
    "MMF_V3_TREND_DOWN_RETURN",
    "MMF_V3_TREND_UP_RETURN",
    "MMF_V3_TREND_DOWN_DIVERGENCE",
    "MMF_V3_TREND_UP_DIVERGENCE",
    "MMF_V3_SUPPORT_DOWN_BREAK",
    "MMF_V3_SUPPORT_UP_BREAK",
    "MMF_V3_RESISTANCE_DOWN_BREAK",
    "MMF_V3_RESISTANCE_UP_BREAK",
    "MMF_V3_TRUE_CLOSE_DOWN",
    "MMF_V3_TRUE_CLOSE_UP",
    "MMF_V3_BULL_MARKET",
    "MMF_V3_BEAR_MARKET",
    "MMF_V3_OVERBOUGHT",
    "MMF_V3_OVERBOUGHT_CLOSE",
    "MMF_V3_OVERSOLD",
    "MMF_V3_OVERSOLD_CLOSE",
    "MMF_V3_TSI_DEAD_CROSS",
    "MMF_V3_TSI_DEAD_CROSS_CONFIRM",
    "MMF_V3_TSI_GOLDEN_CROSS",
    "MMF_V3_TSI_GOLDEN_CROSS_CONFIRM",
    "MMF_V3_BPR_LONG_ENTRY",
    "MMF_V3_BPR_LONG_EXIT",
    "MMF_V3_BPR_SHORT_ENTRY",
    "MMF_V3_BPR_SHORT_EXIT",
    "MMF_V3_BPR_LONG_STOP_LOSS",
    "MMF_V3_BPR_SHORT_STOP_LOSS",
    "MMF_V3_LOW_POSITION_HIGH",
    "MMF_V3_HIGH_POSITION_LOW",
]


@dataclass(frozen=True)
class MmfV3StochSettings:
    length: int = 28
    k_smoothing: int = 6
    d_smoothing: int = 6


@dataclass(frozen=True)
class MmfV3VdoSettings(VdoSettings):
    pass


@dataclass(frozen=True)
class MmfV3MaSettings:
    length: int = 120
    ma_type: str = "sma"
    source: str = "hlc3"


@dataclass(frozen=True)
class MmfV3VmiSettings(VmiSettings):
    pass


@dataclass(frozen=True)
class MmfV3TsiSettings(TsiSettings):
    pass


@dataclass(frozen=True)
class MmfV3MorganSettings:
    anchor: str = "h4"
    ratios: tuple[float, ...] = (-0.236, -0.118, 0.118, 0.236)


@dataclass(frozen=True)
class MmfV3VwapSettings(VwapSettings):
    pass


@dataclass(frozen=True)
class MmfV3SignalSettings:
    enabled: bool = False


@dataclass(frozen=True)
class MmfV3Settings:
    show_high: bool = True
    show_low: bool = True
    show_support_level: bool = False
    show_resistance_level: bool = False
    show_top_divergence_point: bool = False
    show_bottom_divergence_point: bool = False
    show_expected_support_level: bool = False
    show_expected_resistance_level: bool = False
    show_trend_down_rebound_point: bool = False
    show_trend_up_pullback_point: bool = False
    show_trend_down_return_point: bool = False
    show_trend_up_return_point: bool = False
    show_trend_down_divergence_point: bool = False
    show_trend_up_divergence_point: bool = False
    show_support_down_break_point: bool = False
    show_support_up_break_point: bool = False
    show_resistance_down_break_point: bool = False
    show_resistance_up_break_point: bool = False
    show_true_close_down_point: bool = False
    show_true_close_up_point: bool = False
    show_bull_market_point: bool = False
    show_bear_market_point: bool = False
    show_overbought_point: bool = False
    show_overbought_close_point: bool = False
    show_oversold_point: bool = False
    show_oversold_close_point: bool = False
    show_tsi_dead_cross_point: bool = False
    show_tsi_dead_cross_confirm_point: bool = False
    show_tsi_golden_cross_point: bool = False
    show_tsi_golden_cross_confirm_point: bool = False
    show_bpr_m5_strategy: bool = False
    tsi_dead_cross_confirm_distance: float = 5.0
    tsi_golden_cross_confirm_distance: float = 5.0
    true_close_down_vdo_threshold: float = -0.05
    true_close_up_vdo_threshold: float = 0.05
    high_anchor_lookback_bars: int = 14
    low_anchor_lookback_bars: int = 14
    high_stoch_k_advance: float = 10
    low_stoch_k_advance: float = 10
    trend_down_return_morgan_ratio: float = 0.25
    trend_up_return_morgan_ratio: float = 0.25
    trend_down_divergence_morgan_ratio: float = 0.375
    trend_up_divergence_morgan_ratio: float = 0.375
    high_confirm_lookahead_bars: int = 7
    low_confirm_lookahead_bars: int = 7
    stoch: MmfV3StochSettings = field(default_factory=MmfV3StochSettings)
    vdo: MmfV3VdoSettings = field(default_factory=MmfV3VdoSettings)
    vmi: MmfV3VmiSettings = field(default_factory=MmfV3VmiSettings)
    tsi: MmfV3TsiSettings = field(default_factory=MmfV3TsiSettings)
    ma: MmfV3MaSettings = field(default_factory=MmfV3MaSettings)
    morgan: MmfV3MorganSettings = field(default_factory=MmfV3MorganSettings)
    vwap: MmfV3VwapSettings = field(default_factory=MmfV3VwapSettings)
    signals: dict[str, MmfV3SignalSettings] = field(default_factory=dict)


MmfV3Marker = SignalRecord


def create_mmf_v3_marker(
    *,
    type: MmfV3SignalType,
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
    from .signal_catalog import get_mmf_v3_signal_catalog_payload

    return SignalRecord(
        indicator="MMF_V3",
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
        catalog=get_mmf_v3_signal_catalog_payload(type),
    )
