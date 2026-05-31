from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal

from .models import MmfV2SignalType

SignalCategory = Literal["stoch", "level", "trend", "break"]
SignalDirection = Literal["up", "down", "support", "resistance", "neutral"]
SignalTiming = Literal["current", "delayed"]
SignalLayer = Literal["base", "replacement", "outer", "event"]
SignalPlacement = Literal["above", "below"]


@dataclass(frozen=True)
class SignalDefaultStyle:
    symbol: str
    color: str
    size: int
    placement: SignalPlacement


@dataclass(frozen=True)
class MmfV2SignalCatalogEntry:
    id: MmfV2SignalType
    label: str
    category: SignalCategory
    direction: SignalDirection
    role: str
    timing: SignalTiming
    layer: SignalLayer
    strategy_intent: str
    default_style: SignalDefaultStyle
    replaces: tuple[str, ...] = ()
    preserves: tuple[str, ...] = ()

    def to_payload(self) -> dict[str, object]:
        return {
            "catalogId": self.id,
            "label": self.label,
            "category": self.category,
            "direction": self.direction,
            "role": self.role,
            "timing": self.timing,
            "layer": self.layer,
            "strategyIntent": self.strategy_intent,
            "defaultStyle": asdict(self.default_style),
            "replaces": list(self.replaces),
            "preserves": list(self.preserves),
        }


def _entry(
    signal_id: MmfV2SignalType,
    *,
    label: str,
    category: SignalCategory,
    direction: SignalDirection,
    role: str,
    timing: SignalTiming,
    layer: SignalLayer,
    strategy_intent: str,
    symbol: str,
    color: str,
    size: int,
    placement: SignalPlacement,
    replaces: tuple[str, ...] = (),
    preserves: tuple[str, ...] = (),
) -> MmfV2SignalCatalogEntry:
    return MmfV2SignalCatalogEntry(
        id=signal_id,
        label=label,
        category=category,
        direction=direction,
        role=role,
        timing=timing,
        layer=layer,
        strategy_intent=strategy_intent,
        default_style=SignalDefaultStyle(symbol, color, size, placement),
        replaces=replaces,
        preserves=preserves,
    )


MMF_V2_SIGNAL_CATALOG: dict[MmfV2SignalType, MmfV2SignalCatalogEntry] = {
    "MMF_V2_HIGH": _entry("MMF_V2_HIGH", label="high", category="stoch", direction="down", role="base_high", timing="current", layer="base", strategy_intent="structure_reference", symbol="\u25c6", color="#ef5350", size=24, placement="above"),
    "MMF_V2_LOW": _entry("MMF_V2_LOW", label="low", category="stoch", direction="up", role="base_low", timing="current", layer="base", strategy_intent="structure_reference", symbol="\u25c6", color="#26a69a", size=24, placement="below"),
    "MMF_V2_SUPPORT": _entry("MMF_V2_SUPPORT", label="support", category="level", direction="support", role="confirmed_level", timing="delayed", layer="outer", strategy_intent="support_reference", symbol="\u25c6", color="#26a69a", size=24, placement="below", preserves=("current_low_replacement",)),
    "MMF_V2_RESISTANCE": _entry("MMF_V2_RESISTANCE", label="resistance", category="level", direction="resistance", role="confirmed_level", timing="delayed", layer="outer", strategy_intent="resistance_reference", symbol="\u25c6", color="#ef5350", size=24, placement="above", preserves=("current_high_replacement",)),
    "MMF_V2_TOP_DIVERGENCE": _entry("MMF_V2_TOP_DIVERGENCE", label="top divergence", category="trend", direction="down", role="vmi_divergence_point", timing="current", layer="replacement", strategy_intent="resistance_divergence", symbol="\u25c6", color="#ef5350", size=24, placement="above", replaces=("highMarker", "highMarkerPrice", "resistanceMarker", "resistanceMarkerPrice")),
    "MMF_V2_BOTTOM_DIVERGENCE": _entry("MMF_V2_BOTTOM_DIVERGENCE", label="bottom divergence", category="trend", direction="up", role="vmi_divergence_point", timing="current", layer="replacement", strategy_intent="support_divergence", symbol="\u25c6", color="#26a69a", size=24, placement="below", replaces=("lowMarker", "lowMarkerPrice", "supportMarker", "supportMarkerPrice")),
    "MMF_V2_EXPECTED_SUPPORT": _entry("MMF_V2_EXPECTED_SUPPORT", label="expected support", category="level", direction="support", role="expected_level", timing="current", layer="replacement", strategy_intent="support_candidate", symbol="\u25c7", color="#26a69a", size=24, placement="below", replaces=("lowMarker", "lowMarkerPrice")),
    "MMF_V2_EXPECTED_RESISTANCE": _entry("MMF_V2_EXPECTED_RESISTANCE", label="expected resistance", category="level", direction="resistance", role="expected_level", timing="current", layer="replacement", strategy_intent="resistance_candidate", symbol="\u25c7", color="#ef5350", size=24, placement="above", replaces=("highMarker", "highMarkerPrice")),
    "MMF_V2_TREND_DOWN_REBOUND": _entry("MMF_V2_TREND_DOWN_REBOUND", label="downtrend rebound", category="trend", direction="down", role="rebound_point", timing="current", layer="replacement", strategy_intent="short_watch", symbol="\u25c6", color="#26a69a", size=24, placement="above", replaces=("highMarker", "highMarkerPrice", "resistanceMarker", "resistanceMarkerPrice")),
    "MMF_V2_TREND_UP_PULLBACK": _entry("MMF_V2_TREND_UP_PULLBACK", label="uptrend pullback", category="trend", direction="up", role="pullback_point", timing="current", layer="replacement", strategy_intent="long_watch", symbol="\u25c6", color="#ef5350", size=24, placement="below", replaces=("lowMarker", "lowMarkerPrice", "supportMarker", "supportMarkerPrice")),
    "MMF_V2_TREND_DOWN_RETURN": _entry("MMF_V2_TREND_DOWN_RETURN", label="downtrend return", category="trend", direction="down", role="return_point", timing="current", layer="replacement", strategy_intent="short_entry_candidate", symbol="\u25c6", color="#ef5350", size=24, placement="above", replaces=("trendDownReboundMarker", "trendDownReboundMarkerPrice", "highMarker", "highMarkerPrice")),
    "MMF_V2_TREND_UP_RETURN": _entry("MMF_V2_TREND_UP_RETURN", label="uptrend return", category="trend", direction="up", role="return_point", timing="current", layer="replacement", strategy_intent="long_entry_candidate", symbol="\u25c6", color="#26a69a", size=24, placement="below", replaces=("trendUpPullbackMarker", "trendUpPullbackMarkerPrice", "lowMarker", "lowMarkerPrice")),
    "MMF_V2_TREND_DOWN_DIVERGENCE": _entry("MMF_V2_TREND_DOWN_DIVERGENCE", label="downtrend divergence", category="trend", direction="down", role="divergence_point", timing="current", layer="replacement", strategy_intent="short_confirmation_candidate", symbol="\u25c6", color="#ef5350", size=24, placement="below", replaces=("lowMarker", "lowMarkerPrice")),
    "MMF_V2_TREND_UP_DIVERGENCE": _entry("MMF_V2_TREND_UP_DIVERGENCE", label="uptrend divergence", category="trend", direction="up", role="divergence_point", timing="current", layer="replacement", strategy_intent="long_confirmation_candidate", symbol="\u25c6", color="#26a69a", size=24, placement="above", replaces=("highMarker", "highMarkerPrice")),
    "MMF_V2_SUPPORT_DOWN_BREAK": _entry("MMF_V2_SUPPORT_DOWN_BREAK", label="support down break", category="break", direction="down", role="trend_open", timing="current", layer="event", strategy_intent="downtrend_open", symbol="\u25c6", color="#ef5350", size=24, placement="above", replaces=("highMarker", "highMarkerPrice", "resistanceMarker", "resistanceMarkerPrice")),
    "MMF_V2_SUPPORT_UP_BREAK": _entry("MMF_V2_SUPPORT_UP_BREAK", label="support up break", category="break", direction="up", role="trend_close", timing="current", layer="event", strategy_intent="downtrend_close", symbol="\u25c6", color="#26a69a", size=24, placement="below", replaces=("lowMarker", "lowMarkerPrice", "supportMarker", "supportMarkerPrice")),
    "MMF_V2_RESISTANCE_DOWN_BREAK": _entry("MMF_V2_RESISTANCE_DOWN_BREAK", label="resistance down break", category="break", direction="down", role="trend_close", timing="current", layer="event", strategy_intent="uptrend_close", symbol="\u25c6", color="#ef5350", size=24, placement="above", replaces=("highMarker", "highMarkerPrice", "resistanceMarker", "resistanceMarkerPrice")),
    "MMF_V2_RESISTANCE_UP_BREAK": _entry("MMF_V2_RESISTANCE_UP_BREAK", label="resistance up break", category="break", direction="up", role="trend_open", timing="current", layer="event", strategy_intent="uptrend_open", symbol="\u25c6", color="#26a69a", size=24, placement="below", replaces=("lowMarker", "lowMarkerPrice", "supportMarker", "supportMarkerPrice")),
    "MMF_V2_TRUE_CLOSE_DOWN": _entry("MMF_V2_TRUE_CLOSE_DOWN", label="true close down", category="break", direction="down", role="true_close", timing="delayed", layer="event", strategy_intent="uptrend_true_close", symbol="\u25b1", color="#ef5350", size=24, placement="above"),
    "MMF_V2_TRUE_CLOSE_UP": _entry("MMF_V2_TRUE_CLOSE_UP", label="true close up", category="break", direction="up", role="true_close", timing="delayed", layer="event", strategy_intent="downtrend_true_close", symbol="\u25b0", color="#26a69a", size=24, placement="below"),
    "MMF_V2_BULL_MARKET": _entry("MMF_V2_BULL_MARKET", label="bull market", category="trend", direction="up", role="market_state", timing="current", layer="event", strategy_intent="bull_market_open", symbol="\u25c6", color="#26a69a", size=24, placement="below"),
    "MMF_V2_BEAR_MARKET": _entry("MMF_V2_BEAR_MARKET", label="bear market", category="trend", direction="down", role="market_state", timing="current", layer="event", strategy_intent="bear_market_open", symbol="\u25c6", color="#ef5350", size=24, placement="above"),
    "MMF_V2_OVERBOUGHT": _entry("MMF_V2_OVERBOUGHT", label="overbought open", category="trend", direction="up", role="vdo_threshold_state", timing="current", layer="event", strategy_intent="overbought_watch", symbol="\u25c6", color="#ef5350", size=24, placement="below"),
    "MMF_V2_OVERBOUGHT_CLOSE": _entry("MMF_V2_OVERBOUGHT_CLOSE", label="overbought close", category="trend", direction="down", role="vdo_threshold_state_close", timing="current", layer="event", strategy_intent="overbought_close", symbol="\u25c7", color="#ef5350", size=24, placement="above"),
    "MMF_V2_OVERSOLD": _entry("MMF_V2_OVERSOLD", label="oversold open", category="trend", direction="down", role="vdo_threshold_state", timing="current", layer="event", strategy_intent="oversold_watch", symbol="\u25c6", color="#26a69a", size=24, placement="above"),
    "MMF_V2_OVERSOLD_CLOSE": _entry("MMF_V2_OVERSOLD_CLOSE", label="oversold close", category="trend", direction="up", role="vdo_threshold_state_close", timing="current", layer="event", strategy_intent="oversold_close", symbol="\u25c7", color="#26a69a", size=24, placement="below"),
    "MMF_V2_TSI_DEAD_CROSS": _entry("MMF_V2_TSI_DEAD_CROSS", label="TSI dead cross", category="trend", direction="down", role="tsi_dead_cross", timing="current", layer="event", strategy_intent="tsi_cross_reference", symbol="\u2715", color="#ef5350", size=16, placement="above"),
    "MMF_V2_TSI_DEAD_CROSS_CONFIRM": _entry("MMF_V2_TSI_DEAD_CROSS_CONFIRM", label="TSI dead cross confirm", category="trend", direction="down", role="tsi_dead_cross_confirm", timing="delayed", layer="event", strategy_intent="tsi_cross_confirm", symbol="\u2193", color="#ef5350", size=16, placement="above"),
    "MMF_V2_TSI_GOLDEN_CROSS": _entry("MMF_V2_TSI_GOLDEN_CROSS", label="TSI golden cross", category="trend", direction="up", role="tsi_golden_cross", timing="current", layer="event", strategy_intent="tsi_cross_reference", symbol="\u2715", color="#26a69a", size=16, placement="below"),
    "MMF_V2_TSI_GOLDEN_CROSS_CONFIRM": _entry("MMF_V2_TSI_GOLDEN_CROSS_CONFIRM", label="TSI golden cross confirm", category="trend", direction="up", role="tsi_golden_cross_confirm", timing="delayed", layer="event", strategy_intent="tsi_cross_confirm", symbol="\u2191", color="#26a69a", size=16, placement="below"),
    "MMF_V2_LOW_POSITION_HIGH": _entry("MMF_V2_LOW_POSITION_HIGH", label="low position high", category="stoch", direction="down", role="legacy_structure_point", timing="current", layer="replacement", strategy_intent="legacy_reference", symbol="\u25c6", color="#ef5350", size=24, placement="above"),
    "MMF_V2_HIGH_POSITION_LOW": _entry("MMF_V2_HIGH_POSITION_LOW", label="high position low", category="stoch", direction="up", role="legacy_structure_point", timing="current", layer="replacement", strategy_intent="legacy_reference", symbol="\u25c6", color="#26a69a", size=24, placement="below"),
}


def get_mmf_v2_signal_catalog_entry(signal_type: str) -> MmfV2SignalCatalogEntry | None:
    return MMF_V2_SIGNAL_CATALOG.get(signal_type)  # type: ignore[arg-type]


def get_mmf_v2_signal_catalog_payload(signal_type: str) -> dict[str, object]:
    entry = get_mmf_v2_signal_catalog_entry(signal_type)
    return entry.to_payload() if entry is not None else {"catalogId": signal_type}


def get_mmf_v2_signal_catalog() -> list[dict[str, object]]:
    return [entry.to_payload() for entry in MMF_V2_SIGNAL_CATALOG.values()]
