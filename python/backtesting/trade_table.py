from __future__ import annotations

from typing import Any

import pandas as pd


def build_trade_table_from_decisions(
    market_data: pd.DataFrame,
    decisions: list[dict[str, Any]],
    signals: list[dict[str, Any]],
    *,
    strategy_id: str,
    symbol: str,
    timeframe: str,
    size: float = 1.0,
    fees: float = 0.0,
    slippage: float = 0.0,
) -> list[dict[str, Any]]:
    bars = {str(row["barKey"]): row for _, row in market_data.iterrows()}
    signals_by_id = {str(signal["signalId"]): signal for signal in signals if signal.get("signalId")}
    trades: list[dict[str, Any]] = []
    open_trade: dict[str, Any] | None = None

    for decision in decisions:
        order_side = decision.get("orderSide")
        bar_key = str(decision["barKey"])
        bar = bars[bar_key]
        price = float(decision["orderPrice"] if decision.get("orderPrice") is not None else bar["close"])

        if order_side == "buy" and open_trade is None:
            signal = signals_by_id.get(str(decision.get("entrySignal")))
            open_trade = {
                "tradeId": f"{strategy_id}|{len(trades) + 1}",
                "strategyId": strategy_id,
                "symbol": symbol,
                "timeframe": timeframe,
                "direction": "long",
                "entryBarKey": bar_key,
                "entryIndex": int(decision["sourceIndex"]),
                "entryTime": int(decision["time"]),
                "entryPrice": price + slippage,
                "entrySignalType": signal.get("signalType") if signal else None,
                "entryReason": str(decision.get("reason", "")),
                "_entryHigh": float(bar["high"]),
                "_entryLow": float(bar["low"]),
            }
            continue

        if open_trade is not None:
            open_trade["_entryHigh"] = max(float(open_trade["_entryHigh"]), float(bar["high"]))
            open_trade["_entryLow"] = min(float(open_trade["_entryLow"]), float(bar["low"]))

        if order_side == "sell" and open_trade is not None:
            signal = signals_by_id.get(str(decision.get("exitSignal")))
            exit_price = price - slippage
            entry_price = float(open_trade["entryPrice"])
            pnl = (exit_price - entry_price) * size - fees
            bars_held = int(decision["sourceIndex"]) - int(open_trade["entryIndex"])
            trades.append({
                **_strip_private(open_trade),
                "exitBarKey": bar_key,
                "exitIndex": int(decision["sourceIndex"]),
                "exitTime": int(decision["time"]),
                "exitPrice": exit_price,
                "exitSignalType": signal.get("signalType") if signal else None,
                "exitReason": str(decision.get("reason", "")),
                "size": size,
                "pnl": pnl,
                "pnlPercent": pnl / (entry_price * size) if entry_price and size else None,
                "barsHeld": bars_held,
                "maxFavorableExcursion": float(open_trade["_entryHigh"]) - entry_price,
                "maxAdverseExcursion": float(open_trade["_entryLow"]) - entry_price,
                "fees": fees,
                "slippage": slippage,
                "status": "closed",
            })
            open_trade = None

    if open_trade is not None:
        trades.append({
            **_strip_private(open_trade),
            "exitBarKey": None,
            "exitIndex": None,
            "exitTime": None,
            "exitPrice": None,
            "exitSignalType": None,
            "exitReason": None,
            "size": size,
            "pnl": None,
            "pnlPercent": None,
            "barsHeld": None,
            "maxFavorableExcursion": None,
            "maxAdverseExcursion": None,
            "fees": fees,
            "slippage": slippage,
            "status": "open",
        })

    return trades


def _strip_private(trade: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in trade.items() if not key.startswith("_")}
