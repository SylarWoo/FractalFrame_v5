from __future__ import annotations

import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..store_v5.manifest_v5 import delete_dataset_cell, get_dataset_cell, mark_aggregated_dirty_for_symbol, utc_now_iso
from ..store_v5.ohlcv_schema_v5 import mt5_row_to_canonical
from ..store_v5.partitioned_parquet_writer_v5 import append_ohlcv_part_v5
from ..store_v5.store_v5_paths import STORE_VERSION, dataset_key, dataset_root, manifest_path, resolve_store_root
from .mt5_m1_integrity_validator_v1 import validate_incremental_true_m1_rows_v1, validate_true_m1_rows_v1


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

    direct_key = dataset_key(provider="mt5", symbol=symbol, mode="direct", timeframe="M1")
    try:
        if mode == "refresh":
            ds_root = dataset_root(provider="mt5", symbol=symbol, mode="direct", timeframe="M1", store_root=root)
            if ds_root.exists():
                shutil.rmtree(ds_root)
            delete_dataset_cell(root, direct_key)
            raw_rows = _copy_rates_from_pos_chunked(mt5, symbol, mt5.TIMEFRAME_M1, int(count), chunk=refresh_chunk)
            canonical_rows = _canonicalize(raw_rows, symbol=symbol)
            validation = validate_true_m1_rows_v1(canonical_rows)
            if not validation.get("ok"):
                return {
                    **validation,
                    "symbol": symbol,
                    "storeVersion": STORE_VERSION,
                    "importMode": mode,
                    "rowsWritten": 0,
                }
            extra = {
                "mt5RowsCount": validation["mt5RowsCount"],
                "trueM1RowsCount": validation["trueM1RowsCount"],
                "discardedBeforeAnchorRowsCount": validation["discardedBeforeAnchorRowsCount"],
                "firstAnchorTime": validation["firstAnchorTime"],
                "firstAnchorText": validation["firstAnchorText"],
                "lastTrueM1Time": validation["lastTrueM1Time"],
                "firstHourM1CheckOk": validation["firstHourM1CheckOk"],
                "firstHourExpectedRows": validation["firstHourExpectedRows"],
                "firstHourTrueRows": validation["firstHourTrueRows"],
                "gapCount": validation["gapCount"],
                "firstGap": validation["firstGap"],
                "m1IntegrityStatus": validation["m1IntegrityStatus"],
                "lastImportAt": utc_now_iso(),
                "lastImportMode": mode,
                "lastPullMethod": "copy_rates_from_pos",
                "lastPullChunkSize": refresh_chunk,
                "lastAddedRows": validation["trueM1RowsCount"],
                "lastDuplicateRows": 0,
                "dirty": False,
                "compactRecommended": False,
            }
            write = append_ohlcv_part_v5(
                validation["trueRows"],
                provider="mt5",
                symbol=symbol,
                mode="direct",
                timeframe="M1",
                store_root=root,
                source="mt5_terminal",
                manifest_extra=extra,
            )
            mark_aggregated_dirty_for_symbol(root, provider="mt5", symbol=symbol)
            return {
                "ok": True,
                "status": "mt5_m1_refresh_completed",
                "symbol": symbol,
                "storeVersion": STORE_VERSION,
                "importMode": mode,
                "mt5RowsCount": validation["mt5RowsCount"],
                "trueM1RowsCount": validation["trueM1RowsCount"],
                "discardedBeforeAnchorRowsCount": validation["discardedBeforeAnchorRowsCount"],
                "firstAnchorTime": validation["firstAnchorTime"],
                "firstHourM1CheckOk": validation["firstHourM1CheckOk"],
                "firstHourTrueRows": validation["firstHourTrueRows"],
                "gapCount": validation["gapCount"],
                "rowsWritten": write["rowsWritten"],
                "manifestPath": str(manifest_path(root)),
            }

        cell = get_dataset_cell(root, direct_key)
        if not cell or cell.get("lastTrueM1Time") is None:
            return {"ok": False, "error": "direct_m1_manifest_missing_for_incremental", "symbol": symbol, "importMode": mode}
        last_time = int(cell["lastTrueM1Time"])
        from_time = datetime.fromtimestamp(last_time - int(overlap_bars) * 60, tz=timezone.utc)
        to_time = datetime.now(timezone.utc)
        raw_rows = _as_dict_rows(mt5.copy_rates_range(symbol, mt5.TIMEFRAME_M1, from_time, to_time))
        canonical_rows = _canonicalize(raw_rows, symbol=symbol)
        validation = validate_incremental_true_m1_rows_v1(
            canonical_rows,
            last_true_m1_time=last_time,
            overlap_bars=overlap_bars,
        )
        if not validation.get("ok"):
            return {
                **validation,
                "symbol": symbol,
                "storeVersion": STORE_VERSION,
                "importMode": mode,
                "rowsWritten": 0,
            }
        true_new_rows = validation["trueRows"]
        previous_mt5_rows_count = int(cell.get("mt5RowsCount") or cell.get("trueM1RowsCount") or 0)
        extra = {
            "mt5RowsCount": previous_mt5_rows_count + len(true_new_rows),
            "lastPullMt5RowsCount": validation["mt5RowsCount"],
            "trueM1RowsCount": int(cell.get("trueM1RowsCount") or 0) + len(true_new_rows),
            "lastTrueM1Time": validation.get("lastNewTime", last_time),
            "lastImportAt": utc_now_iso(),
            "lastImportMode": mode,
            "lastPullMethod": "copy_rates_range",
            "lastAddedRows": len(true_new_rows),
            "lastDuplicateRows": max(0, validation["mt5RowsCount"] - len(true_new_rows)),
        }
        write = append_ohlcv_part_v5(
            true_new_rows,
            provider="mt5",
            symbol=symbol,
            mode="direct",
            timeframe="M1",
            store_root=root,
            source="mt5_terminal",
            manifest_extra=extra,
        )
        mark_aggregated_dirty_for_symbol(root, provider="mt5", symbol=symbol)
        return {
            "ok": True,
            "status": "mt5_m1_incremental_completed" if true_new_rows else "no_new_true_m1_rows",
            "symbol": symbol,
            "storeVersion": STORE_VERSION,
            "importMode": mode,
            "mt5RowsCount": validation["mt5RowsCount"],
            "trueM1RowsCount": len(true_new_rows),
            "rowsWritten": write["rowsWritten"],
            "lastTrueM1TimeBefore": last_time,
            "lastTrueM1TimeAfter": extra["lastTrueM1Time"],
        }
    finally:
        if hasattr(mt5, "shutdown"):
            mt5.shutdown()
