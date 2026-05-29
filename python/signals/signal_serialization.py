from __future__ import annotations

from typing import Any, Iterable

import pandas as pd

from .signal_model import SignalRecord


def signal_to_record(signal: SignalRecord) -> dict[str, Any]:
    return {
        "signalId": signal.signal_id,
        "indicator": signal.indicator,
        "type": signal.type,
        "eventBarKey": signal.event.bar_key,
        "eventTime": signal.event.time,
        "eventIndex": signal.event.index,
        "confirmBarKey": signal.confirm.bar_key,
        "confirmTime": signal.confirm.time,
        "confirmIndex": signal.confirm.index,
        "markerBarKey": signal.marker.bar_key,
        "markerTime": signal.marker.time,
        "markerIndex": signal.marker.index,
        "markerPrice": signal.marker.price,
        "entryBarKey": signal.entry.bar_key,
        "entryTime": signal.entry.time,
        "entryIndex": signal.entry.index,
        "entryPrice": signal.entry.price,
        "windowStartBarKey": signal.window.start.bar_key,
        "windowStartTime": signal.window.start.time,
        "windowStartIndex": signal.window.start.index,
        "windowEndBarKey": signal.window.end.bar_key,
        "windowEndTime": signal.window.end.time,
        "windowEndIndex": signal.window.end.index,
        "pointDistance": signal.metrics.get("pointDistance"),
        "metrics": dict(signal.metrics),
        "reason": list(signal.reason),
    }


def signals_to_records(signals: Iterable[SignalRecord]) -> list[dict[str, Any]]:
    return [signal_to_record(signal) for signal in signals]


def signals_to_frame(signals: Iterable[SignalRecord]) -> pd.DataFrame:
    records = signals_to_records(signals)
    if not records:
        return pd.DataFrame(columns=[
            "signalId",
            "indicator",
            "type",
            "entryTime",
            "entryPrice",
            "entryBarKey",
            "markerTime",
            "markerPrice",
            "markerBarKey",
            "pointDistance",
        ])
    return pd.DataFrame(records)
