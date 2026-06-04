from __future__ import annotations

from pathlib import Path
from typing import Any

from .manifest_v6 import load_manifest_v6
from .paths_v6 import dataset_key, resolve_store_root
from .schema_v6 import normalize_period


def _format_utc_text(value: int | None) -> str | None:
    if value is None:
        return None
    from datetime import datetime, timezone

    return datetime.fromtimestamp(int(value), tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def check_store_v6(symbol: str, store_root: str | Path | None = None) -> dict[str, Any]:
    root = resolve_store_root(store_root)
    manifest = load_manifest_v6(root)
    raw_key = dataset_key(provider="mt5", symbol=symbol, mode="raw", timeframe="M1")
    clean_key = dataset_key(provider="mt5", symbol=symbol, mode="clean", timeframe="M1")
    raw = manifest.get("datasets", {}).get(raw_key)
    clean = manifest.get("datasets", {}).get(clean_key)
    aggregated = []
    for timeframe in ["M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN"]:
        key = dataset_key(provider="mt5", symbol=symbol, mode="aggregated", timeframe=normalize_period(timeframe), base_timeframe="M1", anchor="UTC2200")
        cell = manifest.get("datasets", {}).get(key)
        if cell:
            aggregated.append({
                "timeframe": timeframe,
                "rowsCount": cell.get("rowsCount"),
                "lastTime": cell.get("lastOpenTime"),
                "lastTimeText": _format_utc_text(cell.get("lastOpenTime")),
                "sourceLastTime": cell.get("sourceLastTime"),
                "sourceTrueM1RowsCount": cell.get("sourceTrueM1RowsCount"),
                "anchor": cell.get("anchor"),
                "dirty": cell.get("dirty"),
                "lastAggregateAt": cell.get("lastAggregateAt"),
            })
    direct = None
    if clean:
        direct = {
            "datasetKey": clean_key,
            "mt5RowsCount": clean.get("mt5RowsCount") or clean.get("rowsCount"),
            "trueM1RowsCount": clean.get("rowsCount"),
            "rowsCount": clean.get("rowsCount"),
            "firstTime": clean.get("firstOpenTime"),
            "lastTime": clean.get("lastOpenTime"),
            "firstTimeText": _format_utc_text(clean.get("firstOpenTime")),
            "lastTimeText": _format_utc_text(clean.get("lastOpenTime")),
            "lastImportAt": clean.get("lastImportAt") or clean.get("updatedAt"),
            "status": clean.get("status"),
            "rootPath": clean.get("rootPath"),
            "validationOk": True,
        }
    raw_direct = None
    if raw:
        raw_rows_count = raw.get("rowsCount")
        raw_direct = {
            "datasetKey": raw_key,
            "mt5RowsCount": raw_rows_count,
            "rawRowsCount": raw_rows_count,
            "rowsCount": raw_rows_count,
            "firstTime": raw.get("firstOpenTime"),
            "lastTime": raw.get("lastOpenTime"),
            "firstTimeText": _format_utc_text(raw.get("firstOpenTime")),
            "lastTimeText": _format_utc_text(raw.get("lastOpenTime")),
            "cleanStatus": "ready" if clean else "pending",
            "lastImportAt": raw.get("lastImportAt") or raw.get("updatedAt"),
            "status": raw.get("status"),
            "rootPath": raw.get("rootPath"),
        }
    return {
        "ok": True,
        "status": "store_v6_check_ready",
        "provider": "store_v6",
        "storeVersion": "store_v6",
        "symbol": symbol,
        "rawDirectM1": raw_direct,
        "directM1": direct,
        "aggregated": aggregated,
        "publishedAt": manifest.get("updatedAt"),
    }
