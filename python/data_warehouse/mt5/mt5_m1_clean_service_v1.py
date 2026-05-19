from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

import pandas as pd

from ..store_v5.manifest_v5 import delete_dataset_cell, get_dataset_cell, mark_aggregated_dirty_for_symbol, utc_now_iso
from ..store_v5.partitioned_parquet_writer_v5 import append_ohlcv_part_v5
from ..store_v5.store_v5_paths import STORE_VERSION, dataset_key, dataset_root, manifest_path, resolve_store_root
from .mt5_m1_integrity_validator_v1 import validate_true_m1_rows_v1


def _read_dataset_rows(store_root: Path, *, symbol: str, mode: str) -> list[dict[str, Any]]:
    root = dataset_root(provider="mt5", symbol=symbol, mode=mode, timeframe="M1", store_root=store_root)
    files = list(root.rglob("part-*.parquet"))
    if not files:
        return []
    frame = pd.concat([pd.read_parquet(file) for file in files], ignore_index=True)
    if frame.empty:
        return []
    return frame.sort_values("time").drop_duplicates("time", keep="last").to_dict("records")


def clean_raw_m1_to_direct_store_v5(
    *,
    symbol: str,
    store_root: str | Path | None = None,
    anchor_hour_utc: int = 22,
    rebuild: bool = True,
) -> dict[str, Any]:
    root = resolve_store_root(store_root)
    raw_key = dataset_key(provider="mt5", symbol=symbol, mode="raw_direct", timeframe="M1")
    direct_key = dataset_key(provider="mt5", symbol=symbol, mode="direct", timeframe="M1")
    raw_cell = get_dataset_cell(root, raw_key)
    if not raw_cell:
        return {"ok": False, "error": "raw_direct_m1_missing", "symbol": symbol, "storeVersion": STORE_VERSION}

    raw_rows = _read_dataset_rows(root, symbol=symbol, mode="raw_direct")
    if not raw_rows:
        return {"ok": False, "error": "raw_direct_m1_empty", "symbol": symbol, "storeVersion": STORE_VERSION}

    validation = validate_true_m1_rows_v1(
        raw_rows,
        anchor_hour_utc=anchor_hour_utc,
        require_utc_anchor=True,
        require_first_hour_complete=True,
    )
    if not validation.get("ok"):
        return {
            **validation,
            "symbol": symbol,
            "storeVersion": STORE_VERSION,
            "sourceDataset": raw_key,
            "cleanDataset": direct_key,
            "rowsWritten": 0,
            "cleanStatus": "failed",
        }
    if validation.get("firstHourM1CheckOk") is not True:
        return {
            **validation,
            "ok": False,
            "error": "first_hour_m1_not_continuous",
            "symbol": symbol,
            "storeVersion": STORE_VERSION,
            "sourceDataset": raw_key,
            "cleanDataset": direct_key,
            "rowsWritten": 0,
            "cleanStatus": "failed",
        }

    direct_root = dataset_root(provider="mt5", symbol=symbol, mode="direct", timeframe="M1", store_root=root)
    if rebuild and direct_root.exists():
        shutil.rmtree(direct_root)
    if rebuild:
        delete_dataset_cell(root, direct_key)

    extra = {
        "sourceDataset": raw_key,
        "sourceRawRowsCount": raw_cell.get("rowsCount"),
        "sourceRawLastTime": raw_cell.get("lastTime"),
        "mt5RowsCount": validation["mt5RowsCount"],
        "trueM1RowsCount": validation["trueM1RowsCount"],
        "discardedBeforeAnchorRowsCount": validation["discardedBeforeAnchorRowsCount"],
        "discardedBeforeTrueM1RowsCount": validation["discardedBeforeTrueM1RowsCount"],
        "firstAnchorTime": validation["firstAnchorTime"],
        "firstAnchorText": validation["firstAnchorText"],
        "firstTrueM1Time": validation["firstTrueM1Time"],
        "firstTrueM1Text": validation["firstTrueM1Text"],
        "lastTrueM1Time": validation["lastTrueM1Time"],
        "firstHourM1CheckOk": validation["firstHourM1CheckOk"],
        "firstHourExpectedRows": validation["firstHourExpectedRows"],
        "firstHourTrueRows": validation["firstHourTrueRows"],
        "gapCount": validation["gapCount"],
        "firstGap": validation["firstGap"],
        "m1IntegrityStatus": validation["m1IntegrityStatus"],
        "lastCleanAt": utc_now_iso(),
        "lastImportAt": raw_cell.get("lastImportAt"),
        "lastImportMode": raw_cell.get("lastImportMode"),
        "status": "ready",
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
        source="store_v5_raw_m1_clean",
        deduplicate_existing_time=not rebuild,
        manifest_extra=extra,
    )
    mark_aggregated_dirty_for_symbol(root, provider="mt5", symbol=symbol)
    return {
        "ok": True,
        "status": "raw_m1_clean_completed",
        "symbol": symbol,
        "storeVersion": STORE_VERSION,
        "sourceDataset": raw_key,
        "cleanDataset": direct_key,
        "mt5RowsCount": validation["mt5RowsCount"],
        "trueM1RowsCount": validation["trueM1RowsCount"],
        "discardedBeforeAnchorRowsCount": validation["discardedBeforeAnchorRowsCount"],
        "firstAnchorTime": validation["firstAnchorTime"],
        "firstHourM1CheckOk": validation["firstHourM1CheckOk"],
        "gapCount": validation["gapCount"],
        "rowsWritten": write["rowsWritten"],
        "manifestPath": str(manifest_path(root)),
    }
