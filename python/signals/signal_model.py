from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class BarCoordinate:
    index: int
    bar_key: str
    time: int
    price: float | None = None

    def to_payload(self, prefix: str) -> dict[str, Any]:
        payload: dict[str, Any] = {
            f"{prefix}Index": self.index,
            f"{prefix}BarKey": self.bar_key,
            f"{prefix}Time": self.time,
        }
        if self.price is not None:
            payload[f"{prefix}Price"] = self.price
        return payload


@dataclass(frozen=True)
class SignalWindow:
    start: BarCoordinate
    end: BarCoordinate

    def to_payload(self) -> dict[str, Any]:
        return {
            "windowStartIndex": self.start.index,
            "windowStartBarKey": self.start.bar_key,
            "windowStartTime": self.start.time,
            "windowEndIndex": self.end.index,
            "windowEndBarKey": self.end.bar_key,
            "windowEndTime": self.end.time,
        }


@dataclass(frozen=True)
class SignalRecord:
    indicator: str
    type: str
    event: BarCoordinate
    confirm: BarCoordinate
    marker: BarCoordinate
    entry: BarCoordinate
    window: SignalWindow
    metrics: dict[str, float] = field(default_factory=dict)
    reason: tuple[str, ...] = ()

    @property
    def signal_id(self) -> str:
        return "|".join([
            self.indicator,
            self.type,
            self.entry.bar_key,
            self.marker.bar_key,
        ])

    def to_payload(self) -> dict[str, Any]:
        point_distance = self.metrics.get("pointDistance")
        return {
            "signalId": self.signal_id,
            "indicator": self.indicator,
            "type": self.type,
            **self.event.to_payload("event"),
            **self.confirm.to_payload("confirm"),
            "markerIndex": self.marker.index,
            "markerBarKey": self.marker.bar_key,
            "index": self.marker.index,
            "time": self.marker.time,
            "price": self.marker.price,
            **self.entry.to_payload("entry"),
            "pointDistance": point_distance,
            **self.window.to_payload(),
            "metrics": self.metrics,
            "reason": list(self.reason),
        }
