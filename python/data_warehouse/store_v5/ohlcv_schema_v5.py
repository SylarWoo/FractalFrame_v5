from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable

import pandas as pd


CANONICAL_COLUMNS = [
    "time",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "provider",
    "symbol",
    "timeframe",
    "source",
    "ingestedAt",
]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def mt5_row_to_canonical(
    row: Any,
    *,
    provider: str,
    symbol: str,
    timeframe: str = "M1",
    source: str = "mt5_terminal",
    ingested_at: str | None = None,
) -> dict[str, Any]:
    if hasattr(row, "_asdict"):
        row = row._asdict()
    if not isinstance(row, dict):
        row = {name: row[name] for name in getattr(row, "dtype", {}).names or []}
    return {
        "time": int(row["time"]),
        "open": float(row["open"]),
        "high": float(row["high"]),
        "low": float(row["low"]),
        "close": float(row["close"]),
        "volume": int(row.get("tick_volume", row.get("volume", 0))),
        "provider": provider,
        "symbol": symbol,
        "timeframe": timeframe,
        "source": source,
        "ingestedAt": ingested_at or utc_now_iso(),
    }


def normalize_ohlcv_rows_v5(
    rows: Iterable[dict[str, Any]],
    *,
    provider: str,
    symbol: str,
    timeframe: str,
    source: str = "mt5_terminal",
    ingested_at: str | None = None,
) -> pd.DataFrame:
    df = pd.DataFrame(list(rows))
    if df.empty:
        return pd.DataFrame(columns=CANONICAL_COLUMNS)

    now = ingested_at or utc_now_iso()
    for col in ["time", "open", "high", "low", "close"]:
        if col not in df.columns:
            raise ValueError(f"Missing OHLCV column: {col}")
    if "volume" not in df.columns:
        if "tick_volume" in df.columns:
            df["volume"] = df["tick_volume"]
        else:
            df["volume"] = 0

    df["time"] = pd.to_numeric(df["time"], errors="raise").astype("int64")
    for col in ["open", "high", "low", "close"]:
        df[col] = pd.to_numeric(df[col], errors="raise").astype("float64")
    df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0).astype("int64")
    if df[["time", "open", "high", "low", "close"]].isna().any().any():
        raise ValueError("OHLCV rows contain null time or price fields")
    if (df["high"] < df["low"]).any():
        raise ValueError("OHLCV rows contain high < low")

    df["provider"] = provider
    df["symbol"] = symbol
    df["timeframe"] = timeframe
    df["source"] = df.get("source", source)
    df["ingestedAt"] = df.get("ingestedAt", now)
    df = df[CANONICAL_COLUMNS].sort_values("time")
    return df.drop_duplicates("time", keep="last").reset_index(drop=True)
