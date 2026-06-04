from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable

import pandas as pd


RAW_COLUMNS = [
    "symbol", "period", "openTime", "closeTime", "timestamp", "barKey",
    "globalIndex", "sessionRuleId", "sessionRuleVersion", "sessionId", "tradingDay",
    "sessionState", "isTradingTime", "sessionOpenTime", "sessionCloseTime",
    "open", "high", "low", "close", "volume",
    "spread", "realVolume", "source", "pullJobId", "pulledAt", "quality", "rejectReason",
]

CLEAN_COLUMNS = [
    "symbol", "period", "openTime", "closeTime", "timestamp", "barKey",
    "globalIndex", "sessionRuleId", "sessionRuleVersion", "sessionId", "tradingDay",
    "sessionState", "isTradingTime", "sessionOpenTime", "sessionCloseTime",
    "open", "high", "low", "close", "volume", "quality", "gapBefore",
    "createdAt", "updatedAt",
]

AGGREGATED_COLUMNS = [
    "symbol", "period", "openTime", "closeTime", "timestamp", "barKey",
    "globalIndex", "sessionRuleId", "sessionRuleVersion", "sessionId", "tradingDay",
    "sessionState", "isTradingTime", "sourcePeriod", "sourceFromOpenTime", "sourceToOpenTime",
    "sourceBars", "expectedSourceBars", "completeness", "open", "high", "low", "close",
    "volume", "createdAt", "updatedAt",
]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize_period(period: str) -> str:
    value = str(period or "").strip().upper()
    return "MN" if value == "MN1" else value


def bar_key(symbol: str, period: str, open_time: int) -> str:
    return f"{symbol}|{normalize_period(period)}|{int(open_time)}"


def mt5_row_to_raw(row: Any, *, symbol: str, period: str = "M1", pull_job_id: str | None = None, pulled_at: str | None = None) -> dict[str, Any]:
    if hasattr(row, "_asdict"):
        row = row._asdict()
    if not isinstance(row, dict):
        row = {name: row[name] for name in getattr(row, "dtype", {}).names or []}
    open_time = int(row["time"])
    normalized_period = normalize_period(period)
    return {
        "symbol": symbol,
        "period": normalized_period,
        "openTime": open_time,
        "closeTime": open_time + 60,
        "timestamp": open_time,
        "barKey": bar_key(symbol, normalized_period, open_time),
        "globalIndex": None,
        "sessionRuleId": None,
        "sessionRuleVersion": None,
        "sessionId": None,
        "tradingDay": None,
        "sessionState": "unknown",
        "isTradingTime": None,
        "sessionOpenTime": None,
        "sessionCloseTime": None,
        "open": float(row["open"]),
        "high": float(row["high"]),
        "low": float(row["low"]),
        "close": float(row["close"]),
        "volume": int(row.get("tick_volume", row.get("volume", 0)) or 0),
        "spread": int(row.get("spread", 0) or 0),
        "realVolume": int(row.get("real_volume", row.get("realVolume", 0)) or 0),
        "source": "mt5_terminal",
        "pullJobId": pull_job_id,
        "pulledAt": pulled_at or utc_now_iso(),
        "quality": "raw",
        "rejectReason": None,
    }


def normalize_raw_rows(rows: Iterable[dict[str, Any]]) -> pd.DataFrame:
    df = pd.DataFrame(list(rows))
    if df.empty:
        return pd.DataFrame(columns=RAW_COLUMNS)
    df["openTime"] = pd.to_numeric(df["openTime"], errors="raise").astype("int64")
    df["closeTime"] = pd.to_numeric(df["closeTime"], errors="raise").astype("int64")
    df["timestamp"] = pd.to_numeric(df["timestamp"], errors="raise").astype("int64")
    for col in ["open", "high", "low", "close"]:
        df[col] = pd.to_numeric(df[col], errors="raise").astype("float64")
    df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0).astype("int64")
    df["spread"] = pd.to_numeric(df.get("spread", 0), errors="coerce").fillna(0).astype("int64")
    df["realVolume"] = pd.to_numeric(df.get("realVolume", 0), errors="coerce").fillna(0).astype("int64")
    df["period"] = df["period"].map(normalize_period)
    df["barKey"] = df.apply(lambda row: bar_key(str(row["symbol"]), str(row["period"]), int(row["openTime"])), axis=1)
    return df[RAW_COLUMNS].sort_values("openTime").drop_duplicates("barKey", keep="last").reset_index(drop=True)


def raw_to_clean_rows(raw_rows: Iterable[dict[str, Any]], *, start_index: int = 0, session_rule: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    from .symbol_sessions_v6 import annotate_time_with_session_rule

    rows = sorted(raw_rows, key=lambda row: int(row["openTime"]))
    out: list[dict[str, Any]] = []
    now = utc_now_iso()
    previous_time: int | None = None
    for offset, row in enumerate(rows):
        open_time = int(row["openTime"])
        reject_reason = None
        if open_time % 60 != 0:
            reject_reason = "off_time_grid"
        high = float(row["high"])
        low = float(row["low"])
        open_price = float(row["open"])
        close_price = float(row["close"])
        if high < max(open_price, close_price, low) or low > min(open_price, close_price, high):
            reject_reason = reject_reason or "ohlcv_invalid"
        if reject_reason:
            continue
        annotation = annotate_time_with_session_rule(str(row["symbol"]), open_time, session_rule)
        out.append({
            "symbol": row["symbol"],
            "period": "M1",
            "openTime": open_time,
            "closeTime": open_time + 60,
            "timestamp": open_time,
            "barKey": bar_key(str(row["symbol"]), "M1", open_time),
            "globalIndex": start_index + offset,
            "sessionRuleId": annotation.get("sessionRuleId"),
            "sessionRuleVersion": annotation.get("sessionRuleVersion"),
            "sessionId": annotation.get("sessionId"),
            "tradingDay": annotation.get("tradingDay"),
            "sessionState": annotation.get("sessionState"),
            "isTradingTime": annotation.get("isTradingTime"),
            "sessionOpenTime": annotation.get("sessionOpenTime"),
            "sessionCloseTime": annotation.get("sessionCloseTime"),
            "open": open_price,
            "high": high,
            "low": low,
            "close": close_price,
            "volume": int(row.get("volume", 0) or 0),
            "quality": "clean",
            "gapBefore": "missing" if previous_time is not None and open_time - previous_time > 60 else "none",
            "createdAt": now,
            "updatedAt": now,
        })
        previous_time = open_time
    return out
