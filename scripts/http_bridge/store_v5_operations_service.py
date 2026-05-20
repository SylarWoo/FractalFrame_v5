from __future__ import annotations

from pathlib import Path
from typing import Any

from .query_params import safe_query_int


def safe_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def pull_store_v5(symbol: str, mode: str, count: int, store_root: Path | None = None) -> dict[str, Any]:
    from python.data_warehouse.mt5.mt5_m1_pull_service_v1 import pull_mt5_m1_to_store_v5

    report = pull_mt5_m1_to_store_v5(
        symbol=symbol,
        import_mode=mode,
        count=count,
        store_root=store_root,
    )
    if mode == "incremental" and report.get("error") in {"direct_m1_manifest_missing_for_incremental", "raw_direct_m1_manifest_missing_for_incremental"}:
        report = pull_mt5_m1_to_store_v5(
            symbol=symbol,
            import_mode="refresh",
            count=count,
            store_root=store_root,
        )
        report["fallbackFrom"] = "incremental"
    return report


def clean_store_v5_direct_m1(symbol: str, store_root: Path | None = None) -> dict[str, Any]:
    from python.data_warehouse.mt5.mt5_m1_clean_service_v1 import clean_raw_m1_to_direct_store_v5

    return clean_raw_m1_to_direct_store_v5(symbol=symbol, store_root=store_root, rebuild=True)


def aggregate_store_v5(symbol: str, timeframes: list[str], rebuild: bool, store_root: Path | None = None) -> dict[str, Any]:
    from python.data_warehouse.aggregate.aggregate_from_m1_service_v1 import aggregate_from_m1_store_v5

    return aggregate_from_m1_store_v5(
        symbol=symbol,
        target_timeframes=timeframes,
        store_root=store_root,
        rebuild=rebuild,
    )


def query_store_v5_ohlcv(params: dict[str, list[str]], store_root: Path | None = None) -> dict[str, Any]:
    from python.data_warehouse.query.duckdb_ohlcv_query_v5 import query_ohlcv_store_v5

    symbol = (params.get("symbol") or [""])[0].strip()
    timeframe = (params.get("timeframe") or ["M1"])[0].strip().upper()
    mode = (params.get("mode") or ["direct"])[0].strip().lower()
    base_timeframe = (params.get("baseTimeframe") or params.get("base_timeframe") or ["M1"])[0].strip().upper()
    anchor = (params.get("anchor") or ["UTC2200"])[0].strip().upper()
    time_from = safe_query_int((params.get("timeFrom") or params.get("time_from") or [None])[0], None)
    time_to = safe_query_int((params.get("timeTo") or params.get("time_to") or [None])[0], None)
    limit = safe_query_int((params.get("limit") or ["5000"])[0], 5000)
    if not symbol:
        return {"ok": False, "status": "bad_request", "error": "symbol_required"}
    payload = query_ohlcv_store_v5(
        symbol=symbol,
        timeframe=timeframe,
        mode=mode,
        base_timeframe=base_timeframe if mode == "aggregated" else None,
        anchor=anchor if mode == "aggregated" else None,
        time_from=time_from,
        time_to=time_to,
        limit=limit,
        store_root=store_root,
    )
    rows = payload.get("rows")
    if isinstance(rows, list):
        rows_by_time: dict[int, dict[str, Any]] = {}
        for row in rows:
            if not isinstance(row, dict):
                continue
            row_time = safe_int(row.get("time"))
            if row_time is None:
                continue
            rows_by_time[row_time] = row
        deduped_rows = [rows_by_time[key] for key in sorted(rows_by_time)]
        payload = {
            **payload,
            "rows": deduped_rows,
            "rowsCount": len(deduped_rows),
        }
        if len(deduped_rows) != len(rows):
            warnings = payload.get("warnings") if isinstance(payload.get("warnings"), list) else []
            payload["warnings"] = [
                *warnings,
                {
                    "status": "duplicate_ohlcv_rows_deduped",
                    "removed": len(rows) - len(deduped_rows),
                },
            ]
    return payload
