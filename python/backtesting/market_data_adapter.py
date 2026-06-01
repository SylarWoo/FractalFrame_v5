from __future__ import annotations

from typing import Any

import pandas as pd

from python.market_data import normalize_ohlcv_bars

MARKET_DATA_COLUMNS = [
    "symbol",
    "timeframe",
    "sourceIndex",
    "barKey",
    "time",
    "open",
    "high",
    "low",
    "close",
    "volume",
]


def create_backtest_bar_key(symbol: str, timeframe: str, time_seconds: Any) -> str:
    return f"{symbol}|{timeframe}|{int(float(time_seconds))}"


def build_market_data_table(
    rows: list[dict[str, Any]] | pd.DataFrame,
    *,
    symbol: str,
    timeframe: str,
) -> pd.DataFrame:
    """Normalize OHLCV input into the backtesting Market Data Table."""
    frame = normalize_ohlcv_bars(rows)
    if frame.empty:
        return pd.DataFrame(columns=MARKET_DATA_COLUMNS)

    out = frame.copy().reset_index(drop=True)
    out["symbol"] = symbol
    out["timeframe"] = timeframe
    out["sourceIndex"] = out.index
    out["time"] = pd.to_numeric(out["time"], errors="coerce").astype("int64")
    out["barKey"] = out["time"].map(lambda value: create_backtest_bar_key(symbol, timeframe, value))
    if "volume" not in out.columns:
        out["volume"] = None
    return out.loc[:, MARKET_DATA_COLUMNS]
