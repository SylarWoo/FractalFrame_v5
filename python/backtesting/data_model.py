from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal


Direction = Literal["long", "short"]
OrderSide = Literal["buy", "sell", "sell_short", "buy_to_cover"]
PositionState = Literal["flat", "long", "short"]
TradeStatus = Literal["open", "closed"]


@dataclass(frozen=True)
class MarketDataRow:
    symbol: str
    timeframe: str
    sourceIndex: int
    barKey: str
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class FeatureTableRow:
    barKey: str
    sourceIndex: int
    time: int
    values: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {"barKey": self.barKey, "sourceIndex": self.sourceIndex, "time": self.time, **self.values}


@dataclass(frozen=True)
class SignalTableRow:
    signalId: str
    signalType: str
    indicator: str
    side: str | None
    direction: str | None
    role: str | None
    barKey: str
    sourceIndex: int
    time: int
    price: float | None
    confirmed: bool
    confirmBarKey: str | None
    confirmIndex: int | None
    confirmTime: int | None
    confirmPrice: float | None
    source: str
    reason: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class StrategyDecisionRow:
    barKey: str
    sourceIndex: int
    time: int
    positionState: PositionState
    entrySignal: str | None
    exitSignal: str | None
    entryAllowed: bool
    exitAllowed: bool
    targetPosition: PositionState
    orderSide: OrderSide | None
    orderType: str | None
    orderPrice: float | None
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class TradeTableRow:
    tradeId: str
    strategyId: str
    symbol: str
    timeframe: str
    direction: Direction
    entryBarKey: str
    entryIndex: int
    entryTime: int
    entryPrice: float
    entrySignalType: str | None
    entryReason: str
    exitBarKey: str | None
    exitIndex: int | None
    exitTime: int | None
    exitPrice: float | None
    exitSignalType: str | None
    exitReason: str | None
    size: float
    pnl: float | None
    pnlPercent: float | None
    barsHeld: int | None
    maxFavorableExcursion: float | None
    maxAdverseExcursion: float | None
    fees: float
    slippage: float
    status: TradeStatus

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
