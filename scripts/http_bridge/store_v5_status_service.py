from __future__ import annotations

import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def safe_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def format_utc_text(value: Any) -> str | None:
    if value is None:
        return None
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    except (TypeError, ValueError, OSError):
        return None


def check_store_v5(symbol: str, store_root: Path | None = None) -> dict[str, Any]:
    from python.data_warehouse.store_v5.manifest_v5 import load_manifest_v5
    from python.data_warehouse.store_v5.store_v5_paths import dataset_key, resolve_store_root

    root = resolve_store_root(store_root)
    raw_key = dataset_key(provider="mt5", symbol=symbol, mode="raw_direct", timeframe="M1")
    direct_key = dataset_key(provider="mt5", symbol=symbol, mode="direct", timeframe="M1")
    manifest = load_manifest_v5(root)
    raw_direct = manifest.get("datasets", {}).get(raw_key)
    direct = manifest.get("datasets", {}).get(direct_key)
    aggregated = [
        cell
        for cell in manifest.get("datasets", {}).values()
        if cell.get("provider") == "mt5" and cell.get("symbol") == symbol and cell.get("mode") == "aggregated"
    ]
    aggregated.sort(key=lambda cell: str(cell.get("timeframe") or ""))

    if not direct:
        return {
            "ok": True,
            "status": "store_v5_direct_m1_missing" if not raw_direct else "store_v5_raw_m1_ready_clean_pending",
            "provider": "store_v5",
            "storeVersion": "v5",
            "symbol": symbol,
            "rawDirectM1": {
                "datasetKey": raw_key,
                "mt5RowsCount": raw_direct.get("mt5RowsCount"),
                "rawRowsCount": raw_direct.get("rawRowsCount"),
                "rowsCount": raw_direct.get("rowsCount"),
                "firstTime": raw_direct.get("firstTime"),
                "lastTime": raw_direct.get("lastTime"),
                "firstTimeText": format_utc_text(raw_direct.get("firstTime")),
                "lastTimeText": format_utc_text(raw_direct.get("lastTime")),
                "cleanStatus": raw_direct.get("cleanStatus"),
                "lastImportAt": raw_direct.get("lastImportAt"),
                "status": raw_direct.get("status"),
                "rootPath": raw_direct.get("rootPath"),
            } if raw_direct else None,
            "directM1": {
                "datasetKey": raw_key,
                "mt5RowsCount": raw_direct.get("mt5RowsCount"),
                "trueM1RowsCount": raw_direct.get("rowsCount") or raw_direct.get("rawRowsCount"),
                "rowsCount": raw_direct.get("rowsCount") or raw_direct.get("rawRowsCount"),
                "firstTime": raw_direct.get("firstTime"),
                "lastTime": raw_direct.get("lastTime"),
                "firstTimeText": format_utc_text(raw_direct.get("firstTime")),
                "lastTimeText": format_utc_text(raw_direct.get("lastTime")),
                "lastImportAt": raw_direct.get("lastImportAt"),
                "status": "raw_m1_ready_clean_pending",
                "rootPath": raw_direct.get("rootPath"),
            } if raw_direct else None,
            "aggregated": aggregated,
            "publishedAt": utc_now_iso(),
        }

    raw_rows_count = safe_int(raw_direct.get("rowsCount")) if raw_direct else None
    raw_last_time = safe_int(raw_direct.get("lastTime")) if raw_direct else None
    direct_rows_count = safe_int(direct.get("rowsCount"))
    direct_last_time = safe_int(direct.get("lastTrueM1Time") or direct.get("lastTime"))
    direct_summary_rows_count = direct.get("rowsCount")
    direct_summary_last_import_at = direct.get("lastImportAt")
    if (
        raw_rows_count is not None
        and raw_rows_count > 0
        and direct_rows_count is not None
        and direct_rows_count > 0
        and raw_rows_count > direct_rows_count * 10
        and (raw_last_time is None or direct_last_time is None or raw_last_time > direct_last_time)
    ):
        direct_summary_rows_count = raw_rows_count
        direct_summary_last_import_at = raw_direct.get("lastImportAt") if raw_direct else direct.get("lastImportAt")

    first_time = direct.get("firstTime") or direct.get("firstAnchorTime")
    last_time = direct.get("lastTrueM1Time") or direct.get("lastTime")
    return {
        "ok": True,
        "status": "store_v5_check_ready",
        "provider": "store_v5",
        "storeVersion": "v5",
        "symbol": symbol,
        "rawDirectM1": {
            "datasetKey": raw_key,
            "mt5RowsCount": raw_direct.get("mt5RowsCount") if raw_direct else None,
            "rawRowsCount": raw_direct.get("rawRowsCount") if raw_direct else None,
            "rowsCount": raw_direct.get("rowsCount") if raw_direct else None,
            "firstTime": raw_direct.get("firstTime") if raw_direct else None,
            "lastTime": raw_direct.get("lastTime") if raw_direct else None,
            "firstTimeText": format_utc_text(raw_direct.get("firstTime")) if raw_direct else None,
            "lastTimeText": format_utc_text(raw_direct.get("lastTime")) if raw_direct else None,
            "cleanStatus": raw_direct.get("cleanStatus") if raw_direct else None,
            "lastImportAt": raw_direct.get("lastImportAt") if raw_direct else None,
            "status": raw_direct.get("status") if raw_direct else None,
            "rootPath": raw_direct.get("rootPath") if raw_direct else None,
        } if raw_direct else None,
        "directM1": {
            "datasetKey": direct_key,
            "mt5RowsCount": direct.get("mt5RowsCount"),
            "trueM1RowsCount": direct.get("trueM1RowsCount"),
            "rowsCount": direct_summary_rows_count,
            "firstTime": first_time,
            "lastTime": last_time,
            "firstTimeText": format_utc_text(first_time),
            "lastTimeText": format_utc_text(last_time),
            "firstAnchorTime": direct.get("firstAnchorTime"),
            "firstHourM1CheckOk": direct.get("firstHourM1CheckOk"),
            "firstHourTrueRows": direct.get("firstHourTrueRows"),
            "gapCount": direct.get("gapCount"),
            "m1IntegrityStatus": direct.get("m1IntegrityStatus"),
            "lastImportAt": direct_summary_last_import_at,
            "status": direct.get("status"),
            "rootPath": direct.get("rootPath"),
        },
        "aggregated": aggregated,
        "publishedAt": utc_now_iso(),
    }


def list_store_v5_symbols(store_root: Path | None = None) -> dict[str, Any]:
    from python.data_warehouse.store_v5.manifest_v5 import load_manifest_v5
    from python.data_warehouse.store_v5.store_v5_paths import resolve_store_root

    root = resolve_store_root(store_root)
    manifest = load_manifest_v5(root)
    symbols: dict[str, dict[str, Any]] = {}
    for cell in manifest.get("datasets", {}).values():
      if cell.get("provider") != "mt5":
          continue
      symbol = str(cell.get("symbol") or "").strip()
      if not symbol:
          continue
      entry = symbols.setdefault(symbol, {
          "symbol": symbol,
          "name": symbol,
          "description": symbol,
          "path": "StoreV5",
          "category": "Local",
          "source": "store_v5",
          "market": "unknown",
          "visible": True,
          "periods": [],
      })
      timeframe = str(cell.get("timeframe") or "").strip().upper()
      mode = str(cell.get("mode") or "").strip().lower()
      rows_count = safe_int(cell.get("rowsCount"))
      if timeframe:
          entry["periods"].append({
              "mode": mode,
              "timeframe": timeframe,
              "rowsCount": rows_count,
              "lastTime": safe_int(cell.get("lastTrueM1Time") or cell.get("lastTime")),
          })

    rows = sorted(symbols.values(), key=lambda row: row["symbol"])
    return {
        "ok": True,
        "status": "store_v5_symbols_ready",
        "provider": "store_v5",
        "storeVersion": "v5",
        "count": len(rows),
        "totalCount": len(rows),
        "symbols": rows,
        "publishedAt": utc_now_iso(),
    }


def delete_store_v5_symbol(symbol: str, store_root: Path | None = None) -> dict[str, Any]:
    from python.data_warehouse.store_v5.manifest_v5 import load_manifest_v5, save_manifest_v5
    from python.data_warehouse.store_v5.store_v5_paths import resolve_store_root

    root = resolve_store_root(store_root)
    datasets_root = (root / "datasets").resolve()
    manifest = load_manifest_v5(root)
    datasets = manifest.get("datasets", {})
    keys_to_delete = [
        key
        for key, cell in datasets.items()
        if cell.get("provider") == "mt5" and cell.get("symbol") == symbol
    ]

    deleted_dirs: list[str] = []
    for key in keys_to_delete:
        cell = datasets.get(key, {})
        rel_root = str(cell.get("rootPath") or "").strip()
        if rel_root:
            target = (root / rel_root).resolve()
            if target == datasets_root or datasets_root not in target.parents:
                return {
                    "ok": False,
                    "status": "store_v5_delete_refused",
                    "error": "dataset_path_outside_store",
                    "symbol": symbol,
                    "path": str(target),
                }
            if target.exists():
                shutil.rmtree(target)
                deleted_dirs.append(str(target))
        datasets.pop(key, None)

    if keys_to_delete:
        save_manifest_v5(manifest, root)

    return {
        "ok": True,
        "status": "store_v5_symbol_deleted" if keys_to_delete else "store_v5_symbol_not_found",
        "symbol": symbol,
        "deletedDatasets": keys_to_delete,
        "deletedDirs": deleted_dirs,
        "publishedAt": utc_now_iso(),
    }


def delete_store_v5_aggregated_timeframes(symbol: str, timeframes: list[str], store_root: Path | None = None) -> dict[str, Any]:
    from python.data_warehouse.store_v5.manifest_v5 import load_manifest_v5, save_manifest_v5
    from python.data_warehouse.store_v5.store_v5_paths import resolve_store_root

    root = resolve_store_root(store_root)
    datasets_root = (root / "datasets").resolve()
    requested = {str(item or "").strip().upper() for item in timeframes if str(item or "").strip()}
    if not requested:
        return {"ok": False, "status": "bad_request", "error": "timeframes_required", "symbol": symbol}

    manifest = load_manifest_v5(root)
    datasets = manifest.get("datasets", {})
    keys_to_delete = [
        key
        for key, cell in datasets.items()
        if (
            cell.get("provider") == "mt5"
            and cell.get("symbol") == symbol
            and cell.get("mode") == "aggregated"
            and str(cell.get("timeframe") or "").strip().upper() in requested
        )
    ]

    deleted_dirs: list[str] = []
    for key in keys_to_delete:
        cell = datasets.get(key, {})
        rel_root = str(cell.get("rootPath") or "").strip()
        if rel_root:
            target = (root / rel_root).resolve()
            if target == datasets_root or datasets_root not in target.parents:
                return {
                    "ok": False,
                    "status": "store_v5_aggregate_delete_refused",
                    "error": "dataset_path_outside_store",
                    "symbol": symbol,
                    "path": str(target),
                }
            if target.exists():
                shutil.rmtree(target)
                deleted_dirs.append(str(target))
        datasets.pop(key, None)

    if keys_to_delete:
        save_manifest_v5(manifest, root)

    return {
        "ok": True,
        "status": "store_v5_aggregated_timeframes_deleted" if keys_to_delete else "store_v5_aggregated_timeframes_not_found",
        "symbol": symbol,
        "timeframes": sorted(requested),
        "deletedDatasets": keys_to_delete,
        "deletedDirs": deleted_dirs,
        "publishedAt": utc_now_iso(),
    }
