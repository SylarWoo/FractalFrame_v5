from __future__ import annotations

import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..store_v5.manifest_v5 import delete_dataset_cell, get_dataset_cell, mark_aggregated_dirty_for_symbol, upsert_dataset_cell, utc_now_iso
from ..store_v5.ohlcv_schema_v5 import mt5_row_to_canonical
from ..store_v5.partitioned_parquet_writer_v5 import append_ohlcv_part_v5
from ..store_v5.store_v5_paths import STORE_VERSION, dataset_key, dataset_root, manifest_path, resolve_store_root


def _load_mt5(mt5_module: Any | None = None) -> Any:
    if mt5_module is not None:
        return mt5_module
    import MetaTrader5 as mt5

    return mt5


def _as_dict_rows(rates: Any) -> list[dict[str, Any]]:
    if rates is None:
        return []
    rows: list[dict[str, Any]] = []
    for row in rates:
        if hasattr(row, "_asdict"):
            rows.append(dict(row._asdict()))
        elif isinstance(row, dict):
            rows.append(dict(row))
        else:
            names = getattr(getattr(row, "dtype", None), "names", None)
            if names:
                rows.append({name: row[name].item() if hasattr(row[name], "item") else row[name] for name in names})
            else:
                rows.append(dict(row))
    return rows


def _canonicalize(rows: list[dict[str, Any]], *, symbol: str) -> list[dict[str, Any]]:
    return [mt5_row_to_canonical(row, provider="mt5", symbol=symbol, timeframe="M1") for row in rows]


def _mark_clean_direct_stale(root: Path, *, symbol: str, reason: str) -> None:
    direct_key = dataset_key(provider="mt5", symbol=symbol, mode="direct", timeframe="M1")
    cell = get_dataset_cell(root, direct_key)
    if not cell:
        return
    cell = {
        **cell,
        "status": "stale",
        "dirty": True,
        "cleanStatus": "stale",
        "staleReason": reason,
        "updatedAt": utc_now_iso(),
    }
    upsert_dataset_cell(root, direct_key, cell)


def _copy_rates_from_pos_chunked(mt5: Any, symbol: str, timeframe: Any, count: int, chunk: int = 10_000) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    pos = 0
    total = 0
    target = int(count)
    step = max(1, int(chunk))
    while total < target:
        want = min(step, target - total)
        part = _as_dict_rows(mt5.copy_rates_from_pos(symbol, timeframe, pos, want))
        if not part:
            break
        rows.extend(part)
        pulled = len(part)
        total += pulled
        pos += pulled
        if pulled < want:
            break
    return rows


def _init_mt5(mt5: Any, symbol: str) -> tuple[bool, str | None]:
    if hasattr(mt5, "initialize") and not mt5.initialize():
        return False, "mt5_initialize_failed"
    if hasattr(mt5, "symbol_select") and not mt5.symbol_select(symbol, True):
        return False, "mt5_symbol_select_failed"
    return True, None


def pull_mt5_m1_to_store_v5(
    *,
    symbol: str,
    count: int = 5_000_000,
    import_mode: str = "incremental",
    store_root: str | Path | None = None,
    overlap_bars: int = 1000,
    refresh_chunk: int = 10_000,
    mt5_module: Any | None = None,
) -> dict[str, Any]:
    root = resolve_store_root(store_root)
    mode = import_mode.lower()
    if mode not in {"refresh", "incremental"}:
        return {"ok": False, "error": "unsupported_import_mode", "importMode": import_mode}

    mt5 = _load_mt5(mt5_module)
    ok, error = _init_mt5(mt5, symbol)
    if not ok:
        return {"ok": False, "error": error, "symbol": symbol, "storeVersion": STORE_VERSION, "importMode": mode}

    raw_key = dataset_key(provider="mt5", symbol=symbol, mode="raw_direct", timeframe="M1")
    try:
        if mode == "refresh":
            ds_root = dataset_root(provider="mt5", symbol=symbol, mode="raw_direct", timeframe="M1", store_root=root)
            if ds_root.exists():
                shutil.rmtree(ds_root)
            delete_dataset_cell(root, raw_key)
            raw_rows = _copy_rates_from_pos_chunked(mt5, symbol, mt5.TIMEFRAME_M1, int(count), chunk=refresh_chunk)
            canonical_rows = _canonicalize(raw_rows, symbol=symbol)
            first_time = min((int(row["time"]) for row in canonical_rows), default=None)
            last_time = max((int(row["time"]) for row in canonical_rows), default=None)
            extra = {
                "mt5RowsCount": len(raw_rows),
                "rawRowsCount": len(canonical_rows),
                "firstRawM1Time": first_time,
                "lastRawM1Time": last_time,
                "rawIngestStatus": "raw_m1_written",
                "cleanStatus": "pending",
                "lastImportAt": utc_now_iso(),
                "lastImportMode": mode,
                "lastPullMethod": "copy_rates_from_pos",
                "lastPullChunkSize": refresh_chunk,
                "lastAddedRows": len(canonical_rows),
                "lastDuplicateRows": 0,
                "dirty": False,
                "compactRecommended": False,
            }
            write = append_ohlcv_part_v5(
                canonical_rows,
                provider="mt5",
                symbol=symbol,
                mode="raw_direct",
                timeframe="M1",
                store_root=root,
                source="mt5_terminal",
                manifest_extra=extra,
            )
            _mark_clean_direct_stale(root, symbol=symbol, reason="raw_direct_refreshed")
            mark_aggregated_dirty_for_symbol(root, provider="mt5", symbol=symbol)
            return {
                "ok": True,
                "status": "mt5_m1_raw_refresh_completed",
                "symbol": symbol,
                "storeVersion": STORE_VERSION,
                "importMode": mode,
                "datasetMode": "raw_direct",
                "mt5RowsCount": len(raw_rows),
                "rawRowsCount": len(canonical_rows),
                "firstRawM1Time": first_time,
                "lastRawM1Time": last_time,
                "rowsWritten": write["rowsWritten"],
                "duplicateRows": write["duplicateRows"],
                "cleanStatus": "pending",
                "manifestPath": str(manifest_path(root)),
            }

        cell = get_dataset_cell(root, raw_key)
        if not cell or cell.get("lastTime") is None:
            return {"ok": False, "error": "raw_direct_m1_manifest_missing_for_incremental", "symbol": symbol, "importMode": mode}
        last_time = int(cell["lastTime"])
        from_time = datetime.fromtimestamp(last_time - int(overlap_bars) * 60, tz=timezone.utc)
        to_time = datetime.now(timezone.utc)
        raw_rows = _as_dict_rows(mt5.copy_rates_range(symbol, mt5.TIMEFRAME_M1, from_time, to_time))
        canonical_rows = _canonicalize(raw_rows, symbol=symbol)
        previous_mt5_rows_count = int(cell.get("mt5RowsCount") or cell.get("rowsCount") or 0)
        extra = {
            "mt5RowsCount": previous_mt5_rows_count + len(canonical_rows),
            "lastPullMt5RowsCount": len(raw_rows),
            "rawIngestStatus": "raw_m1_written",
            "cleanStatus": "pending",
            "lastImportAt": utc_now_iso(),
            "lastImportMode": mode,
            "lastPullMethod": "copy_rates_range",
            "lastAddedRows": len(canonical_rows),
        }
        write = append_ohlcv_part_v5(
            canonical_rows,
            provider="mt5",
            symbol=symbol,
            mode="raw_direct",
            timeframe="M1",
            store_root=root,
            source="mt5_terminal",
            manifest_extra=extra,
        )
        _mark_clean_direct_stale(root, symbol=symbol, reason="raw_direct_incremental_updated")
        mark_aggregated_dirty_for_symbol(root, provider="mt5", symbol=symbol)
        return {
            "ok": True,
            "status": "mt5_m1_raw_incremental_completed" if write["rowsWritten"] else "no_new_raw_m1_rows",
            "symbol": symbol,
            "storeVersion": STORE_VERSION,
            "importMode": mode,
            "datasetMode": "raw_direct",
            "mt5RowsCount": len(raw_rows),
            "rawRowsCount": len(canonical_rows),
            "rowsWritten": write["rowsWritten"],
            "duplicateRows": write["duplicateRows"],
            "lastRawM1TimeBefore": last_time,
            "lastRawM1TimeAfter": write["manifestCell"].get("lastTime"),
            "cleanStatus": "pending",
        }
    finally:
        if hasattr(mt5, "shutdown"):
            mt5.shutdown()
