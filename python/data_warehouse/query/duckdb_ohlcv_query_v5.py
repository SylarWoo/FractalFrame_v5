from __future__ import annotations

from pathlib import Path
from typing import Any

import duckdb

from ..store_v5.manifest_v5 import load_manifest_v5
from ..store_v5.store_v5_paths import dataset_key, dataset_root, resolve_store_root


def _parquet_part_files(ds_root: Path) -> list[str]:
    return sorted(str(path) for path in ds_root.rglob("part-*.parquet"))


def _fetch_rows(sql: str, params: list[Any]) -> list[dict[str, Any]]:
    con = duckdb.connect(database=":memory:")
    try:
        return con.execute(sql, params).fetchdf().to_dict("records")
    finally:
        con.close()


def _query_latest_rows(files: list[str], limit: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    # StoreV5 part names are partitioned by year/month and part date, so reverse
    # path order lets the common "latest N bars" path avoid scanning old history.
    for start in range(0, len(files), 8):
        batch = list(reversed(files))[start : start + 8]
        if not batch:
            break
        need = max(limit, limit - len(rows))
        sql = "SELECT * FROM read_parquet(?) ORDER BY time DESC LIMIT ?"
        rows.extend(_fetch_rows(sql, [batch, need]))
        rows = sorted(rows, key=lambda row: int(row["time"]), reverse=True)[:limit]
        if len(rows) >= limit:
            break
    return list(reversed(rows))


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
    files = _parquet_part_files(ds_root)
    if not files:
        return {"ok": False, "error": "dataset_has_no_parquet_parts", "datasetKey": key, "rows": []}

    if time_from is None and time_to is None and limit is not None:
        rows = _query_latest_rows(files, int(limit))
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
            "warnings": [],
        }

    if time_from is None and time_to is not None and limit is not None:
        sql = "SELECT * FROM read_parquet(?) WHERE time <= ? ORDER BY time DESC LIMIT ?"
        rows = list(reversed(_fetch_rows(sql, [files, int(time_to), int(limit)])))
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
            "warnings": [],
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
    sql = f"SELECT * FROM read_parquet(?) {where_sql} ORDER BY time {limit_sql}"
    rows = _fetch_rows(sql, params)
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
        "warnings": [],
    }
