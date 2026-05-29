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


MMF_V2_SIGNAL_CATALOG: dict[MmfV2SignalType, MmfV2SignalCatalogEntry] = {
    "MMF_V2_HIGH": MmfV2SignalCatalogEntry(
        id="MMF_V2_HIGH",
        label="高点",
        category="stoch",
        direction="down",
        role="base_high",
        timing="current",
        layer="base",
        strategy_intent="structure_reference",
        default_style=SignalDefaultStyle("\u25c6", "#ef5350", 24, "above"),
    ),
    "MMF_V2_LOW": MmfV2SignalCatalogEntry(
        id="MMF_V2_LOW",
        label="低点",
        category="stoch",
        direction="up",
        role="base_low",
        timing="current",
        layer="base",
        strategy_intent="structure_reference",
        default_style=SignalDefaultStyle("\u25c6", "#26a69a", 24, "below"),
    ),
    "MMF_V2_SUPPORT": MmfV2SignalCatalogEntry(
        id="MMF_V2_SUPPORT",
        label="支撑位",
        category="level",
        direction="support",
        role="confirmed_level",
        timing="delayed",
        layer="outer",
        strategy_intent="support_reference",
        default_style=SignalDefaultStyle("\u25c6", "#26a69a", 24, "below"),
        preserves=("current_low_replacement",),
    ),
    "MMF_V2_RESISTANCE": MmfV2SignalCatalogEntry(
        id="MMF_V2_RESISTANCE",
        label="阻力位",
        category="level",
        direction="resistance",
        role="confirmed_level",
        timing="delayed",
        layer="outer",
        strategy_intent="resistance_reference",
        default_style=SignalDefaultStyle("\u25c6", "#ef5350", 24, "above"),
        preserves=("current_high_replacement",),
    ),
    "MMF_V2_EXPECTED_SUPPORT": MmfV2SignalCatalogEntry(
        id="MMF_V2_EXPECTED_SUPPORT",
        label="预期支撑位",
        category="level",
        direction="support",
        role="expected_level",
        timing="current",
        layer="replacement",
        strategy_intent="support_candidate",
        default_style=SignalDefaultStyle("\u25c7", "#26a69a", 24, "below"),
        replaces=("lowMarker", "lowMarkerPrice"),
    ),
    "MMF_V2_EXPECTED_RESISTANCE": MmfV2SignalCatalogEntry(
        id="MMF_V2_EXPECTED_RESISTANCE",
        label="预期阻力位",
        category="level",
        direction="resistance",
        role="expected_level",
        timing="current",
        layer="replacement",
        strategy_intent="resistance_candidate",
        default_style=SignalDefaultStyle("\u25c7", "#ef5350", 24, "above"),
        replaces=("highMarker", "highMarkerPrice"),
    ),
    "MMF_V2_TREND_DOWN_REBOUND": MmfV2SignalCatalogEntry(
        id="MMF_V2_TREND_DOWN_REBOUND",
        label="下降趋势 - 反弹点",
        category="trend",
        direction="down",
        role="rebound_point",
        timing="current",
        layer="replacement",
        strategy_intent="short_watch",
        default_style=SignalDefaultStyle("\u25c6", "#26a69a", 24, "above"),
        replaces=("highMarker", "highMarkerPrice"),
    ),
    "MMF_V2_TREND_UP_PULLBACK": MmfV2SignalCatalogEntry(
        id="MMF_V2_TREND_UP_PULLBACK",
        label="上升趋势 - 回撤点",
        category="trend",
        direction="up",
        role="pullback_point",
        timing="current",
        layer="replacement",
        strategy_intent="long_watch",
        default_style=SignalDefaultStyle("\u25c6", "#ef5350", 24, "below"),
        replaces=("lowMarker", "lowMarkerPrice"),
    ),
    "MMF_V2_TREND_DOWN_RETURN": MmfV2SignalCatalogEntry(
        id="MMF_V2_TREND_DOWN_RETURN",
        label="下降趋势 - 回归点",
        category="trend",
        direction="down",
        role="return_point",
        timing="current",
        layer="replacement",
        strategy_intent="short_entry_candidate",
        default_style=SignalDefaultStyle("\u25c6", "#ef5350", 24, "above"),
        replaces=("trendDownReboundMarker", "trendDownReboundMarkerPrice", "highMarker", "highMarkerPrice"),
    ),
    "MMF_V2_TREND_UP_RETURN": MmfV2SignalCatalogEntry(
        id="MMF_V2_TREND_UP_RETURN",
        label="上升趋势 - 回归点",
        category="trend",
        direction="up",
        role="return_point",
        timing="current",
        layer="replacement",
        strategy_intent="long_entry_candidate",
        default_style=SignalDefaultStyle("\u25c6", "#26a69a", 24, "below"),
        replaces=("trendUpPullbackMarker", "trendUpPullbackMarkerPrice", "lowMarker", "lowMarkerPrice"),
    ),
    "MMF_V2_TREND_DOWN_DIVERGENCE": MmfV2SignalCatalogEntry(
        id="MMF_V2_TREND_DOWN_DIVERGENCE",
        label="下降趋势 - 背离点",
        category="trend",
        direction="down",
        role="divergence_point",
        timing="current",
        layer="replacement",
        strategy_intent="short_confirmation_candidate",
        default_style=SignalDefaultStyle("\u25c6", "#ef5350", 24, "below"),
        replaces=("lowMarker", "lowMarkerPrice"),
    ),
    "MMF_V2_TREND_UP_DIVERGENCE": MmfV2SignalCatalogEntry(
        id="MMF_V2_TREND_UP_DIVERGENCE",
        label="上升趋势 - 背离点",
        category="trend",
        direction="up",
        role="divergence_point",
        timing="current",
        layer="replacement",
        strategy_intent="long_confirmation_candidate",
        default_style=SignalDefaultStyle("\u25c6", "#26a69a", 24, "above"),
        replaces=("highMarker", "highMarkerPrice"),
    ),
    "MMF_V2_SUPPORT_DOWN_BREAK": MmfV2SignalCatalogEntry(
        id="MMF_V2_SUPPORT_DOWN_BREAK",
        label="支撑位向下突破",
        category="break",
        direction="down",
        role="trend_open",
        timing="current",
        layer="event",
        strategy_intent="downtrend_open",
        default_style=SignalDefaultStyle("\u25c6", "#ef5350", 24, "above"),
        replaces=("highMarker", "highMarkerPrice", "resistanceMarker", "resistanceMarkerPrice"),
    ),
    "MMF_V2_SUPPORT_UP_BREAK": MmfV2SignalCatalogEntry(
        id="MMF_V2_SUPPORT_UP_BREAK",
        label="支撑位向上突破",
        category="break",
        direction="up",
        role="trend_close",
        timing="current",
        layer="event",
        strategy_intent="downtrend_close",
        default_style=SignalDefaultStyle("\u25c6", "#26a69a", 24, "below"),
        replaces=("lowMarker", "lowMarkerPrice", "supportMarker", "supportMarkerPrice"),
    ),
    "MMF_V2_RESISTANCE_UP_BREAK": MmfV2SignalCatalogEntry(
        id="MMF_V2_RESISTANCE_UP_BREAK",
        label="阻力位向上突破",
        category="break",
        direction="up",
        role="trend_open",
        timing="current",
        layer="event",
        strategy_intent="uptrend_open",
        default_style=SignalDefaultStyle("\u25c6", "#26a69a", 24, "below"),
        replaces=("lowMarker", "lowMarkerPrice", "supportMarker", "supportMarkerPrice"),
    ),
    "MMF_V2_RESISTANCE_DOWN_BREAK": MmfV2SignalCatalogEntry(
        id="MMF_V2_RESISTANCE_DOWN_BREAK",
        label="阻力位向下突破",
        category="break",
        direction="down",
        role="trend_close",
        timing="current",
        layer="event",
        strategy_intent="uptrend_close",
        default_style=SignalDefaultStyle("\u25c6", "#ef5350", 24, "above"),
        replaces=("highMarker", "highMarkerPrice", "resistanceMarker", "resistanceMarkerPrice"),
    ),
}


def get_mmf_v2_signal_catalog_entry(signal_type: str) -> MmfV2SignalCatalogEntry | None:
    return MMF_V2_SIGNAL_CATALOG.get(signal_type)  # type: ignore[arg-type]


def get_mmf_v2_signal_catalog_payload(signal_type: str) -> dict[str, object]:
    entry = get_mmf_v2_signal_catalog_entry(signal_type)
    return entry.to_payload() if entry is not None else {"catalogId": signal_type}


def get_mmf_v2_signal_catalog() -> list[dict[str, object]]:
    return [entry.to_payload() for entry in MMF_V2_SIGNAL_CATALOG.values()]
