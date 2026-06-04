from __future__ import annotations

import shutil
from pathlib import Path
from urllib.parse import parse_qs

from .store_v5_operations_service import safe_int


def check_store_v6(symbol: str, store_root: Path | None = None) -> dict:
    from python.data_warehouse.store_v6.status_v6 import check_store_v6 as _check

    payload = _check(symbol, store_root=store_root)
    payload["liveLag"] = _check_store_v6_live_lag(symbol, payload)
    return payload


def _check_store_v6_live_lag(symbol: str, payload: dict) -> dict:
    direct = payload.get("directM1") if isinstance(payload.get("directM1"), dict) else {}
    store_last_time = safe_int(direct.get("lastTime"))
    base = {
        "ok": False,
        "symbol": symbol,
        "storeLastM1Time": store_last_time,
        "storeLastM1TimeText": direct.get("lastTimeText"),
        "mt5LatestM1Time": None,
        "mt5LatestM1TimeText": None,
        "lagSeconds": None,
        "lagM1Bars": None,
        "status": "mt5_unchecked",
    }
    try:
        import MetaTrader5 as mt5
    except ImportError as exc:
        return {**base, "status": "mt5_unavailable", "error": str(exc)}

    try:
        from .mt5_m1_rows import mt5_rates_to_rows
        from python.data_warehouse.store_v6.status_v6 import _format_utc_text

        if not mt5.initialize():
            return {**base, "status": "mt5_initialize_failed", "mt5LastError": mt5.last_error()}
        if not mt5.symbol_select(symbol, True):
            return {**base, "status": "mt5_symbol_select_failed", "mt5LastError": mt5.last_error()}
        rows = mt5_rates_to_rows(mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, 2))
        times = sorted(
            value
            for value in (safe_int(row.get("time")) for row in rows)
            if value is not None
        )
        mt5_latest_time = times[-1] if times else None
        if mt5_latest_time is None:
            return {**base, "status": "mt5_latest_m1_empty", "mt5LastError": mt5.last_error()}
        lag_seconds = None if store_last_time is None else max(0, mt5_latest_time - store_last_time)
        lag_bars = None if lag_seconds is None else lag_seconds // 60
        return {
            **base,
            "ok": True,
            "status": "store_v6_live_lag_ready",
            "mt5LatestM1Time": mt5_latest_time,
            "mt5LatestM1TimeText": _format_utc_text(mt5_latest_time),
            "lagSeconds": lag_seconds,
            "lagM1Bars": lag_bars,
        }
    except Exception as exc:
        return {**base, "status": "store_v6_live_lag_failed", "error": str(exc)}


def pull_store_v6(symbol: str, mode: str, count: int | None, store_root: Path | None = None) -> dict:
    from python.data_warehouse.store_v6.pull_v6 import pull_mt5_m1_to_store_v6

    return pull_mt5_m1_to_store_v6(
        symbol=symbol,
        mode=mode,
        count=count,
        store_root=store_root,
        batch_size=20_000,
    )


def aggregate_store_v6(symbol: str, timeframes: list[str], rebuild: bool, store_root: Path | None = None) -> dict:
    from python.data_warehouse.store_v6.aggregate_v6 import aggregate_from_m1_store_v6

    return aggregate_from_m1_store_v6(symbol=symbol, target_timeframes=timeframes, rebuild=rebuild, store_root=store_root)


def query_store_v6_ohlcv(params: dict[str, list[str]], store_root: Path | None = None) -> dict:
    from python.data_warehouse.store_v6.query_v6 import query_ohlcv_store_v6

    symbol = (params.get("symbol") or [""])[0].strip()
    timeframe = (params.get("timeframe") or params.get("period") or ["M1"])[0].strip().upper()
    if timeframe == "MN1":
        timeframe = "MN"
    mode = (params.get("mode") or [None])[0]
    index_from = safe_int((params.get("indexFrom") or params.get("index_from") or [None])[0])
    index_to = safe_int((params.get("indexTo") or params.get("index_to") or [None])[0])
    time_from = safe_int((params.get("timeFrom") or params.get("from") or [None])[0])
    time_to = safe_int((params.get("timeTo") or params.get("to") or [None])[0])
    limit = safe_int((params.get("limit") or [5000])[0])
    return query_ohlcv_store_v6(
        symbol=symbol,
        timeframe=timeframe,
        mode=mode,
        index_from=index_from,
        index_to=index_to,
        time_from=time_from,
        time_to=time_to,
        limit=limit,
        store_root=store_root,
    )


def query_store_v6_index_times(params: dict[str, list[str]], store_root: Path | None = None) -> dict:
    from python.data_warehouse.store_v6.query_v6 import query_index_times_store_v6

    symbol = (params.get("symbol") or [""])[0].strip()
    timeframe = (params.get("timeframe") or params.get("period") or ["M1"])[0].strip().upper()
    if timeframe == "MN1":
        timeframe = "MN"
    mode = (params.get("mode") or [None])[0]
    indices_text = ",".join(params.get("indices") or params.get("index") or [])
    indices = [
        value
        for value in (safe_int(part.strip()) for part in indices_text.split(","))
        if value is not None
    ]
    return query_index_times_store_v6(
        symbol=symbol,
        timeframe=timeframe,
        mode=mode,
        indices=indices,
        store_root=store_root,
    )


def audit_store_v6(symbol: str, *, repair: bool = False, store_root: Path | None = None) -> dict:
    from python.data_warehouse.store_v6.audit_v6 import audit_store_v6 as _audit

    return _audit(symbol, store_root=store_root, repair=repair)


def list_store_v6_symbols(store_root: Path | None = None) -> dict:
    from python.data_warehouse.store_v6.manifest_v6 import load_manifest_v6, utc_now_iso
    from python.data_warehouse.store_v6.paths_v6 import resolve_store_root

    root = resolve_store_root(store_root)
    manifest = load_manifest_v6(root)
    symbols: dict[str, dict] = {}
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
            "path": "StoreV6",
            "category": "Local",
            "source": "store_v6",
            "market": "unknown",
            "visible": True,
            "periods": [],
        })
        timeframe = str(cell.get("timeframe") or "").strip().upper()
        mode = str(cell.get("mode") or "").strip().lower()
        if timeframe:
            entry["periods"].append({
                "mode": mode,
                "timeframe": "MN" if timeframe == "MN1" else timeframe,
                "rowsCount": safe_int(cell.get("rowsCount")),
                "lastTime": safe_int(cell.get("lastOpenTime") or cell.get("lastTime")),
            })

    rows = sorted(symbols.values(), key=lambda row: row["symbol"])
    return {
        "ok": True,
        "status": "store_v6_symbols_ready",
        "provider": "store_v6",
        "storeVersion": "store_v6",
        "count": len(rows),
        "totalCount": len(rows),
        "symbols": rows,
        "publishedAt": utc_now_iso(),
    }


def delete_store_v6_symbol(symbol: str, store_root: Path | None = None) -> dict:
    from python.data_warehouse.store_v6.manifest_v6 import load_manifest_v6, save_manifest_v6, utc_now_iso
    from python.data_warehouse.store_v6.paths_v6 import resolve_store_root

    root = resolve_store_root(store_root)
    manifest = load_manifest_v6(root)
    datasets = manifest.get("datasets", {})
    keys_to_delete = [
        key
        for key, cell in datasets.items()
        if cell.get("provider") == "mt5" and cell.get("symbol") == symbol
    ]
    deleted_dirs = _delete_store_v6_dataset_dirs(root, [datasets.get(key, {}) for key in keys_to_delete])
    for key in keys_to_delete:
        datasets.pop(key, None)
    if keys_to_delete:
        manifest.get("symbols", {}).pop(symbol, None)
        save_manifest_v6(manifest, root)
    return {
        "ok": True,
        "status": "store_v6_symbol_deleted" if keys_to_delete else "store_v6_symbol_not_found",
        "symbol": symbol,
        "deletedDatasets": keys_to_delete,
        "deletedDirs": deleted_dirs,
        "publishedAt": utc_now_iso(),
    }


def delete_store_v6_aggregated_timeframes(symbol: str, timeframes: list[str], store_root: Path | None = None) -> dict:
    from python.data_warehouse.store_v6.manifest_v6 import load_manifest_v6, save_manifest_v6, utc_now_iso
    from python.data_warehouse.store_v6.paths_v6 import resolve_store_root
    from python.data_warehouse.store_v6.schema_v6 import normalize_period

    requested = {normalize_period(item) for item in timeframes if str(item or "").strip()}
    if not requested:
        return {"ok": False, "status": "bad_request", "error": "timeframes_required", "symbol": symbol}

    root = resolve_store_root(store_root)
    manifest = load_manifest_v6(root)
    datasets = manifest.get("datasets", {})
    keys_to_delete = [
        key
        for key, cell in datasets.items()
        if (
            cell.get("provider") == "mt5"
            and cell.get("symbol") == symbol
            and cell.get("mode") == "aggregated"
            and normalize_period(str(cell.get("timeframe") or "")) in requested
        )
    ]
    deleted_dirs = _delete_store_v6_dataset_dirs(root, [datasets.get(key, {}) for key in keys_to_delete])
    for key in keys_to_delete:
        datasets.pop(key, None)
    if keys_to_delete:
        save_manifest_v6(manifest, root)
    return {
        "ok": True,
        "status": "store_v6_aggregated_timeframes_deleted" if keys_to_delete else "store_v6_aggregated_timeframes_not_found",
        "symbol": symbol,
        "timeframes": sorted(requested),
        "deletedDatasets": keys_to_delete,
        "deletedDirs": deleted_dirs,
        "publishedAt": utc_now_iso(),
    }


def _delete_store_v6_dataset_dirs(root: Path, cells: list[dict]) -> list[str]:
    deleted_dirs: list[str] = []
    allowed_roots = [(root / name).resolve() for name in ["raw", "clean", "aggregated", "quality", "index"]]
    for cell in cells:
        rel_root = str(cell.get("rootPath") or "").strip()
        if not rel_root:
            continue
        target = (root / rel_root).resolve()
        if not any(target == allowed or allowed in target.parents for allowed in allowed_roots):
            raise ValueError(f"store_v6_dataset_path_outside_store: {target}")
        if target.exists():
            shutil.rmtree(target)
            deleted_dirs.append(str(target))
    return deleted_dirs
