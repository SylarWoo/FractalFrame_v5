from __future__ import annotations

from pathlib import Path
from typing import Any

import duckdb
import pandas as pd

from ..store_v5.manifest_v5 import load_manifest_v5
from ..store_v5.store_v5_paths import dataset_key, dataset_root, resolve_store_root

MAX_QUERY_LIMIT = 100_000


def _parquet_part_files(ds_root: Path) -> list[str]:
    return sorted(str(path) for path in ds_root.rglob("part-*.parquet"))


def _month_start(timestamp_seconds: int) -> pd.Timestamp:
    dt = pd.to_datetime(int(timestamp_seconds), unit="s", utc=True)
    return pd.Timestamp(year=dt.year, month=dt.month, day=1, tz="UTC")


def _month_partition_files(ds_root: Path, *, time_from: int | None, time_to: int | None) -> list[str]:
    if time_from is None and time_to is None:
        return _parquet_part_files(ds_root)
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
        try:
            volume = row.get("volume", 0)
            out.append(
                {
                    "time": int(row["time"]),
                    "open": float(row["open"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "close": float(row["close"]),
                    "volume": int(0 if pd.isna(volume) else volume),
                }
            )
        except (KeyError, TypeError, ValueError):
            continue
    return out


def _normalize_limit(limit: int | None) -> tuple[int | None, list[str]]:
    if limit is None:
        return None, []
    normalized = max(1, min(int(limit), MAX_QUERY_LIMIT))
    warnings = ["limit_clamped"] if normalized != int(limit) else []
    return normalized, warnings


def _query_latest_rows(files: list[str], limit: int) -> list[dict[str, Any]]:
    sql = """
    WITH ranked AS (
      SELECT
        time,
        open,
        high,
        low,
        close,
        volume,
        ROW_NUMBER() OVER (
          PARTITION BY time
          ORDER BY volume DESC, ABS(high - low) DESC, filename DESC
        ) AS row_rank
      FROM read_parquet(?, filename=true)
    )
    SELECT time, open, high, low, close, volume
    FROM ranked
    WHERE row_rank = 1
    ORDER BY time DESC
    LIMIT ?
    """
    return list(reversed(_fetch_rows(sql, [files, int(limit)])))


def query_ohlcv_store_v5(
    *,
    symbol: str,
    timeframe: str,
    provider: str = "mt5",
    mode: str = "direct",
    base_timeframe: str | None = None,
    anchor: str | None = None,
    time_from: int | None = None,
    time_to: int | None = None,
    limit: int | None = 5000,
    store_root: str | Path | None = None,
) -> dict[str, Any]:
    root = resolve_store_root(store_root)
    limit, warnings = _normalize_limit(limit)
    if mode == "aggregated":
        base_timeframe = base_timeframe or "M1"
        anchor = anchor or "UTC2200"
    key = dataset_key(
        provider=provider,
        symbol=symbol,
        mode=mode,
        timeframe=timeframe,
        base_timeframe=base_timeframe,
        anchor=anchor,
    )
    manifest = load_manifest_v5(root)
    if key not in manifest.get("datasets", {}):
        return {"ok": False, "error": "dataset_not_found", "datasetKey": key, "rows": []}
    ds_root = dataset_root(
        provider=provider,
        symbol=symbol,
        mode=mode,
        timeframe=timeframe,
        base_timeframe=base_timeframe,
        anchor=anchor,
        store_root=root,
    )
    files = _month_partition_files(ds_root, time_from=time_from, time_to=time_to)
    if not files:
        return {"ok": False, "error": "dataset_has_no_parquet_parts", "datasetKey": key, "rows": []}

    if time_from is None and time_to is None and limit is not None:
        rows = _ohlcv_rows(_query_latest_rows(files, int(limit)))
        time_values = [int(row["time"]) for row in rows]
        return {
            "ok": True,
            "provider": "store_v5_duckdb",
            "storeVersion": "v5",
            "symbol": symbol,
            "timeframe": timeframe,
            "mode": mode,
            "baseTimeframe": base_timeframe,
            "anchor": anchor,
            "rowsCount": len(rows),
            "rows": rows,
            "metadata": {
                "queryEngineId": "ohlcv_store_v5_duckdb_v1",
                "datasetKey": key,
                "parquetPathsCount": len(files),
                "timeFromResult": min(time_values) if time_values else None,
                "timeToResult": max(time_values) if time_values else None,
                "window": "latest",
            },
            "warnings": warnings,
        }

    if time_from is None and time_to is not None and limit is not None:
        sql = """
        WITH ranked AS (
          SELECT
            time,
            open,
            high,
            low,
            close,
            volume,
            ROW_NUMBER() OVER (
              PARTITION BY time
              ORDER BY volume DESC, ABS(high - low) DESC, filename DESC
            ) AS row_rank
          FROM read_parquet(?, filename=true)
          WHERE time <= ?
        )
        SELECT time, open, high, low, close, volume
        FROM ranked
        WHERE row_rank = 1
        ORDER BY time DESC
        LIMIT ?
        """
        rows = _ohlcv_rows(list(reversed(_fetch_rows(sql, [files, int(time_to), int(limit)]))))
        time_values = [int(row["time"]) for row in rows]
        return {
            "ok": True,
            "provider": "store_v5_duckdb",
            "storeVersion": "v5",
            "symbol": symbol,
            "timeframe": timeframe,
            "mode": mode,
            "baseTimeframe": base_timeframe,
            "anchor": anchor,
            "rowsCount": len(rows),
            "rows": rows,
            "metadata": {
                "queryEngineId": "ohlcv_store_v5_duckdb_v1",
                "datasetKey": key,
                "parquetPathsCount": len(files),
                "timeFromResult": min(time_values) if time_values else None,
                "timeToResult": max(time_values) if time_values else None,
                "window": "backward",
            },
            "warnings": warnings,
        }

    clauses = []
    params: list[Any] = [files]
    if time_from is not None:
        clauses.append("time >= ?")
        params.append(int(time_from))
    if time_to is not None:
        clauses.append("time <= ?")
        params.append(int(time_to))
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    limit_sql = "LIMIT ?" if limit is not None else ""
    if limit is not None:
        params.append(int(limit))
    sql = f"""
    WITH ranked AS (
      SELECT
        time,
        open,
        high,
        low,
        close,
        volume,
        ROW_NUMBER() OVER (
          PARTITION BY time
          ORDER BY volume DESC, ABS(high - low) DESC, filename DESC
        ) AS row_rank
      FROM read_parquet(?, filename=true)
      {where_sql}
    )
    SELECT time, open, high, low, close, volume
    FROM ranked
    WHERE row_rank = 1
    ORDER BY time
    {limit_sql}
    """
    rows = _ohlcv_rows(_fetch_rows(sql, params))
    time_values = [int(row["time"]) for row in rows]
    return {
        "ok": True,
        "provider": "store_v5_duckdb",
        "storeVersion": "v5",
        "symbol": symbol,
        "timeframe": timeframe,
        "mode": mode,
        "baseTimeframe": base_timeframe,
        "anchor": anchor,
        "rowsCount": len(rows),
        "rows": rows,
        "metadata": {
            "queryEngineId": "ohlcv_store_v5_duckdb_v1",
            "datasetKey": key,
            "parquetPathsCount": len(files),
            "timeFromResult": min(time_values) if time_values else None,
            "timeToResult": max(time_values) if time_values else None,
        },
        "warnings": warnings,
    }
