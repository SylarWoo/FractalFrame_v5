from __future__ import annotations

from pathlib import Path
from typing import Any

import duckdb
import pandas as pd

from .manifest_v6 import load_manifest_v6
from .paths_v6 import dataset_key, dataset_root, resolve_store_root
from .schema_v6 import normalize_period

MAX_QUERY_LIMIT = 100_000


def _month_start(timestamp_seconds: int) -> pd.Timestamp:
    dt = pd.to_datetime(int(timestamp_seconds), unit="s", utc=True)
    return pd.Timestamp(year=dt.year, month=dt.month, day=1, tz="UTC")


def _month_partition_files(ds_root: Path, *, time_from: int | None, time_to: int | None) -> list[str]:
    if time_from is not None and time_to is not None and int(time_from) > int(time_to):
        return []
    start = _month_start(int(time_from)) if time_from is not None else None
    end = _month_start(int(time_to)) if time_to is not None else None
    out: list[str] = []
    for month_dir in ds_root.glob("year=*/month=*"):
        if not month_dir.is_dir():
            continue
        try:
            year = int(month_dir.parent.name.split("=", 1)[1])
            month = int(month_dir.name.split("=", 1)[1])
        except (IndexError, ValueError):
            continue
        partition_month = pd.Timestamp(year=year, month=month, day=1, tz="UTC")
        if start is not None and partition_month < start:
            continue
        if end is not None and partition_month > end:
            continue
        out.extend(str(path) for path in month_dir.glob("part-*.parquet"))
    return sorted(out)


def _fetch_rows(sql: str, params: list[Any]) -> list[dict[str, Any]]:
    con = duckdb.connect(database=":memory:")
    try:
        return con.execute(sql, params).fetchdf().to_dict("records")
    finally:
        con.close()


def _ohlcv_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in rows:
        volume = row.get("volume", 0)
        out.append({
            "time": int(row["openTime"]),
            "openTime": int(row["openTime"]),
            "closeTime": int(row.get("closeTime") or int(row["openTime"])),
            "timestamp": int(row["openTime"]) * 1000,
            "barKey": str(row.get("barKey") or ""),
            "globalIndex": None if pd.isna(row.get("globalIndex")) else int(row.get("globalIndex")),
            "sessionRuleId": None if pd.isna(row.get("sessionRuleId")) else row.get("sessionRuleId"),
            "sessionRuleVersion": None if pd.isna(row.get("sessionRuleVersion")) else int(row.get("sessionRuleVersion")),
            "sessionId": None if pd.isna(row.get("sessionId")) else row.get("sessionId"),
            "tradingDay": None if pd.isna(row.get("tradingDay")) else row.get("tradingDay"),
            "sessionState": None if pd.isna(row.get("sessionState")) else row.get("sessionState"),
            "isTradingTime": None if pd.isna(row.get("isTradingTime")) else bool(row.get("isTradingTime")),
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "volume": int(0 if pd.isna(volume) else volume),
        })
    return out


def _normalize_limit(limit: int | None) -> tuple[int | None, list[str]]:
    if limit is None:
        return None, []
    normalized = max(1, min(int(limit), MAX_QUERY_LIMIT))
    warnings = ["limit_clamped"] if normalized != int(limit) else []
    return normalized, warnings


def query_ohlcv_store_v6(
    *,
    symbol: str,
    timeframe: str,
    provider: str = "mt5",
    mode: str | None = None,
    base_timeframe: str | None = None,
    anchor: str | None = None,
    index_from: int | None = None,
    index_to: int | None = None,
    time_from: int | None = None,
    time_to: int | None = None,
    limit: int | None = 5000,
    store_root: str | Path | None = None,
) -> dict[str, Any]:
    root = resolve_store_root(store_root)
    timeframe = normalize_period(timeframe)
    if mode is None:
        mode = "clean" if timeframe == "M1" else "aggregated"
    if mode == "aggregated":
        base_timeframe = base_timeframe or "M1"
        anchor = anchor or "UTC2200"
    key = dataset_key(provider=provider, symbol=symbol, mode=mode, timeframe=timeframe, base_timeframe=base_timeframe, anchor=anchor)
    manifest = load_manifest_v6(root)
    if key not in manifest.get("datasets", {}):
        return {"ok": False, "error": "dataset_not_found", "datasetKey": key, "rows": []}
    ds_root = dataset_root(provider=provider, symbol=symbol, mode=mode, timeframe=timeframe, base_timeframe=base_timeframe, anchor=anchor, store_root=root)
    files = _month_partition_files(ds_root, time_from=time_from, time_to=time_to)
    if not files:
        return {"ok": False, "error": "dataset_has_no_parquet_parts", "datasetKey": key, "rows": []}
    limit, warnings = _normalize_limit(limit)

    clauses = []
    params: list[Any] = [files]
    if index_from is not None:
        clauses.append("globalIndex >= ?")
        params.append(int(index_from))
    if index_to is not None:
        clauses.append("globalIndex <= ?")
        params.append(int(index_to))
    if time_from is not None:
        clauses.append("openTime >= ?")
        params.append(int(time_from))
    if time_to is not None:
        clauses.append("openTime <= ?")
        params.append(int(time_to))
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    latest_window = time_from is None and time_to is None and index_from is None and index_to is None and limit is not None
    backwards_window = time_from is None and index_from is None and limit is not None and (time_to is not None or index_to is not None)
    order_sql = "ORDER BY openTime DESC" if latest_window or backwards_window else "ORDER BY openTime"
    limit_sql = "LIMIT ?" if limit is not None else ""
    if limit is not None:
        params.append(int(limit))
    sql = f"""
    WITH ranked AS (
      SELECT
        openTime, closeTime, barKey, globalIndex, sessionRuleId, sessionRuleVersion,
        sessionId, tradingDay, sessionState, isTradingTime,
        open, high, low, close, volume,
        ROW_NUMBER() OVER (
          PARTITION BY barKey
          ORDER BY volume DESC, ABS(high - low) DESC, filename DESC
        ) AS row_rank
      FROM read_parquet(?, filename=true, union_by_name=true)
      {where_sql}
    )
    SELECT
      openTime, closeTime, barKey, globalIndex, sessionRuleId, sessionRuleVersion,
      sessionId, tradingDay, sessionState, isTradingTime,
      open, high, low, close, volume
    FROM ranked
    WHERE row_rank = 1
    {order_sql}
    {limit_sql}
    """
    raw = _fetch_rows(sql, params)
    rows = _ohlcv_rows(list(reversed(raw)) if order_sql.endswith("DESC") else raw)
    time_values = [int(row["openTime"]) for row in rows]
    index_values = [int(row["globalIndex"]) for row in rows if row.get("globalIndex") is not None]
    return {
        "ok": True,
        "provider": "store_v6_duckdb",
        "storeVersion": "store_v6",
        "symbol": symbol,
        "timeframe": timeframe,
        "mode": mode,
        "baseTimeframe": base_timeframe,
        "anchor": anchor,
        "rowsCount": len(rows),
        "rows": rows,
        "metadata": {
            "queryEngineId": "ohlcv_store_v6_duckdb_v1",
            "datasetKey": key,
            "parquetPathsCount": len(files),
            "indexFromResult": min(index_values) if index_values else None,
            "indexToResult": max(index_values) if index_values else None,
            "timeFromResult": min(time_values) if time_values else None,
            "timeToResult": max(time_values) if time_values else None,
        },
        "warnings": warnings,
    }


def query_index_times_store_v6(
    *,
    symbol: str,
    timeframe: str,
    indices: list[int],
    provider: str = "mt5",
    mode: str | None = None,
    base_timeframe: str | None = None,
    anchor: str | None = None,
    store_root: str | Path | None = None,
) -> dict[str, Any]:
    normalized_indices = sorted({int(index) for index in indices if int(index) >= 0})
    if not normalized_indices:
        return {
            "ok": True,
            "provider": "store_v6_duckdb",
            "storeVersion": "store_v6",
            "symbol": symbol,
            "timeframe": normalize_period(timeframe),
            "rowsCount": 0,
            "rows": [],
        }

    root = resolve_store_root(store_root)
    timeframe = normalize_period(timeframe)
    if mode is None:
        mode = "clean" if timeframe == "M1" else "aggregated"
    if mode == "aggregated":
        base_timeframe = base_timeframe or "M1"
        anchor = anchor or "UTC2200"
    key = dataset_key(provider=provider, symbol=symbol, mode=mode, timeframe=timeframe, base_timeframe=base_timeframe, anchor=anchor)
    manifest = load_manifest_v6(root)
    if key not in manifest.get("datasets", {}):
        return {"ok": False, "error": "dataset_not_found", "datasetKey": key, "rows": []}
    ds_root = dataset_root(provider=provider, symbol=symbol, mode=mode, timeframe=timeframe, base_timeframe=base_timeframe, anchor=anchor, store_root=root)
    files = _month_partition_files(ds_root, time_from=None, time_to=None)
    if not files:
        return {"ok": False, "error": "dataset_has_no_parquet_parts", "datasetKey": key, "rows": []}

    placeholders = ", ".join("?" for _ in normalized_indices)
    params: list[Any] = [files, *normalized_indices]
    sql = f"""
    WITH ranked AS (
      SELECT
        openTime, globalIndex,
        ROW_NUMBER() OVER (
          PARTITION BY globalIndex
          ORDER BY volume DESC, ABS(high - low) DESC, filename DESC
        ) AS row_rank
      FROM read_parquet(?, filename=true, union_by_name=true)
      WHERE globalIndex IN ({placeholders})
    )
    SELECT globalIndex, openTime
    FROM ranked
    WHERE row_rank = 1
    ORDER BY globalIndex
    """
    raw = _fetch_rows(sql, params)
    rows = [
        {
            "globalIndex": int(row["globalIndex"]),
            "time": int(row["openTime"]),
            "openTime": int(row["openTime"]),
        }
        for row in raw
        if row.get("globalIndex") is not None and not pd.isna(row.get("globalIndex"))
    ]
    return {
        "ok": True,
        "provider": "store_v6_duckdb",
        "storeVersion": "store_v6",
        "symbol": symbol,
        "timeframe": timeframe,
        "mode": mode,
        "baseTimeframe": base_timeframe,
        "anchor": anchor,
        "rowsCount": len(rows),
        "rows": rows,
        "metadata": {
            "queryEngineId": "index_times_store_v6_duckdb_v1",
            "datasetKey": key,
            "requestedIndicesCount": len(normalized_indices),
            "parquetPathsCount": len(files),
        },
    }
