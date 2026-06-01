from __future__ import annotations

from typing import Any

import pandas as pd

LONG_ENTRY_DIRECTIONS = {"up", "bullish", "long"}
LONG_EXIT_DIRECTIONS = {"down", "bearish", "short"}


def build_signal_following_decisions(
    market_data: pd.DataFrame,
    signals: list[dict[str, Any]],
    *,
    strategy_id: str = "signal_following_v1",
) -> list[dict[str, Any]]:
    signal_by_bar_key = _first_signal_by_bar_key(signals)
    position = "flat"
    rows: list[dict[str, Any]] = []

    for _, bar in market_data.iterrows():
        bar_key = str(bar["barKey"])
        source_index = int(bar["sourceIndex"])
        time = int(bar["time"])
        price = float(bar["close"])
        signal = signal_by_bar_key.get(bar_key)
        direction = str(signal.get("direction", "")).lower() if signal else ""
        position_before = position
        entry_allowed = position == "flat" and direction in LONG_ENTRY_DIRECTIONS
        exit_allowed = position == "long" and direction in LONG_EXIT_DIRECTIONS
        order_side = None
        entry_signal = None
        exit_signal = None
        reason = "hold"

        if entry_allowed and signal:
            position = "long"
            order_side = "buy"
            entry_signal = str(signal["signalId"])
            reason = f"{strategy_id}: enter long on {signal['signalType']}"
        elif exit_allowed and signal:
            position = "flat"
            order_side = "sell"
            exit_signal = str(signal["signalId"])
            reason = f"{strategy_id}: exit long on {signal['signalType']}"

        rows.append({
            "barKey": bar_key,
            "sourceIndex": source_index,
            "time": time,
            "positionState": position_before,
            "entrySignal": entry_signal,
            "exitSignal": exit_signal,
            "entryAllowed": entry_allowed,
            "exitAllowed": exit_allowed,
            "targetPosition": position,
            "orderSide": order_side,
            "orderType": "market" if order_side else None,
            "orderPrice": price if order_side else None,
            "reason": reason,
        })

    return rows


def _first_signal_by_bar_key(signals: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for signal in sorted(signals, key=lambda item: (int(item.get("sourceIndex", 0)), str(item.get("signalId", "")))):
        bar_key = str(signal.get("barKey", ""))
        if bar_key and bar_key not in out:
            out[bar_key] = signal
    return out
