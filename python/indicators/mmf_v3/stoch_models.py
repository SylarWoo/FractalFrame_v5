from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

StochCrossDirection = Literal["dead", "golden"]
PriceAnchorType = Literal["high", "low"]


@dataclass(frozen=True)
class StochCrossEvent:
    direction: StochCrossDirection
    index: int
    bar_key: str
    time: int
    value: float
    k: float
    d: float
    previous_index: int
    previous_k: float
    previous_d: float


@dataclass(frozen=True)
class StochConfirmEvent:
    cross: StochCrossEvent
    index: int
    bar_key: str
    time: int
    k: float
    advance: float
    bars_used: int
    max_bars: int


@dataclass(frozen=True)
class PriceAnchor:
    type: PriceAnchorType
    index: int
    bar_key: str
    time: int
    price: float
    window_start_index: int
    window_start_bar_key: str
    window_start_time: int
    window_end_index: int
    window_end_bar_key: str
    window_end_time: int


@dataclass(frozen=True)
class StochStateSignal:
    type: Literal["high", "low"]
    cross: StochCrossEvent
    confirm: StochConfirmEvent
    anchor: PriceAnchor
    entry_index: int
    entry_bar_key: str
    entry_time: int
    entry_price: float
    point_distance: float
