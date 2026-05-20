from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .mt5_m1_check_service import mt5_rates_to_rows
from .store_v5_operations_service import safe_int
from .store_v5_status_service import utc_now_iso


def repair_store_v5_m1_gaps(
    symbol: str,
    *,
    lookback_minutes: int = 360,
    max_gap_minutes: int = 240,
    store_root: Path | None = None,
) -> dict[str, Any]:
    from python.data_warehouse.query.duckdb_ohlcv_query_v5 import query_ohlcv_store_v5
    from python.data_warehouse.store_v5.manifest_v5 import get_dataset_cell, mark_aggregated_dirty_for_symbol
    from python.data_warehouse.store_v5.ohlcv_schema_v5 import mt5_row_to_canonical
    from python.data_warehouse.store_v5.partitioned_parquet_writer_v5 import append_ohlcv_part_v5
    from python.data_warehouse.store_v5.store_v5_paths import dataset_key, resolve_store_root

    root = resolve_store_root(store_root)
    direct_key = dataset_key(provider="mt5", symbol=symbol, mode="direct", timeframe="M1")
    direct_cell = get_dataset_cell(root, direct_key)
    last_time = safe_int(direct_cell.get("lastTrueM1Time") or direct_cell.get("lastTime")) if direct_cell else None
    if last_time is None:
        return {
            "ok": True,
            "status": "m1_gap_repair_skipped_no_direct_m1",
            "symbol": symbol,
            "gapsDetected": 0,
            "rowsWritten": 0,
            "publishedAt": utc_now_iso(),
        }

    lookback_seconds = max(60, min(int(lookback_minutes), 7 * 24 * 60)) * 60
    max_gap_seconds = max(120, min(int(max_gap_minutes), 24 * 60)) * 60
    time_from = int(last_time) - lookback_seconds
    payload = query_ohlcv_store_v5(
        symbol=symbol,
        timeframe="M1",
        mode="direct",
        time_from=time_from,
        time_to=int(last_time),
        limit=max(1000, int(lookback_minutes) + 500),
        store_root=root,
    )
    rows = payload.get("rows") if isinstance(payload, dict) else []
    existing_rows_by_time: dict[int, dict[str, Any]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        row_time = safe_int(row.get("time"))
        if row_time is not None:
            existing_rows_by_time[row_time] = row
    ordered_times = sorted({
        int(row.get("time"))
        for row in rows
        if isinstance(row, dict) and safe_int(row.get("time")) is not None
    })

    gaps: list[dict[str, int]] = []
    for previous_time, next_time in zip(ordered_times, ordered_times[1:]):
        delta = next_time - previous_time
        if delta <= 60:
            continue
        if delta > max_gap_seconds:
            continue
        gaps.append({
            "previousTime": previous_time,
            "nextTime": next_time,
            "deltaSeconds": delta,
            "missingBarsEstimate": max(0, delta // 60 - 1),
        })

    try:
        import MetaTrader5 as mt5
    except ImportError as exc:
        return {
            "ok": False,
            "status": "m1_gap_repair_mt5_unavailable",
            "error": str(exc),
            "symbol": symbol,
            "gapsDetected": len(gaps),
            "rowsWritten": 0,
            "publishedAt": utc_now_iso(),
        }

    initialized = False
    try:
        if not mt5.initialize():
            return {
                "ok": False,
                "status": "m1_gap_repair_mt5_init_failed",
                "error": "mt5_initialize_failed",
                "mt5LastError": mt5.last_error(),
                "symbol": symbol,
                "gapsDetected": len(gaps),
                "rowsWritten": 0,
                "publishedAt": utc_now_iso(),
            }
        initialized = True
        if not mt5.symbol_select(symbol, True):
            return {
                "ok": False,
                "status": "m1_gap_repair_symbol_select_failed",
                "error": "mt5_symbol_select_failed",
                "mt5LastError": mt5.last_error(),
                "symbol": symbol,
                "gapsDetected": len(gaps),
                "rowsWritten": 0,
                "publishedAt": utc_now_iso(),
            }

        def row_quality(row: dict[str, Any]) -> tuple[int, float]:
            volume = safe_int(row.get("volume"))
            try:
                high = float(row.get("high"))
                low = float(row.get("low"))
                spread = abs(high - low)
            except (TypeError, ValueError):
                spread = 0.0
            return (0 if volume is None else volume, spread)

        repair_rows_by_time: dict[int, dict[str, Any]] = {}

        recent_rates = mt5.copy_rates_range(
            symbol,
            mt5.TIMEFRAME_M1,
            datetime.fromtimestamp(time_from, tz=timezone.utc),
            datetime.fromtimestamp(int(last_time), tz=timezone.utc),
        )
        for row in mt5_rates_to_rows(recent_rates):
            row_time = safe_int(row.get("time"))
            if row_time is None or row_time < time_from or row_time > int(last_time):
                continue
            canonical = mt5_row_to_canonical(row, provider="mt5", symbol=symbol, timeframe="M1")
            existing = existing_rows_by_time.get(row_time)
            if existing is None or row_quality(canonical) > row_quality(existing):
                repair_rows_by_time[row_time] = canonical

        for gap in gaps:
            rates = mt5.copy_rates_range(
                symbol,
                mt5.TIMEFRAME_M1,
                datetime.fromtimestamp(int(gap["previousTime"]) + 60, tz=timezone.utc),
                datetime.fromtimestamp(int(gap["nextTime"]) - 60, tz=timezone.utc),
            )
            for row in mt5_rates_to_rows(rates):
                row_time = safe_int(row.get("time"))
                if row_time is None:
                    continue
                if row_time <= gap["previousTime"] or row_time >= gap["nextTime"]:
                    continue
                repair_rows_by_time[row_time] = mt5_row_to_canonical(row, provider="mt5", symbol=symbol, timeframe="M1")

        repair_rows = [repair_rows_by_time[key] for key in sorted(repair_rows_by_time)]
        if not repair_rows:
            return {
                "ok": True,
                "status": "m1_gap_repair_no_rows_available_from_mt5",
                "symbol": symbol,
                "lookbackMinutes": lookback_minutes,
                "gapsDetected": len(gaps),
                "gaps": gaps,
                "rowsWritten": 0,
                "publishedAt": utc_now_iso(),
            }

        raw_write = append_ohlcv_part_v5(
            repair_rows,
            provider="mt5",
            symbol=symbol,
            mode="raw_direct",
            timeframe="M1",
            store_root=root,
            source="store_v5_m1_recent_repair",
            deduplicate_existing_time=False,
        )
        previous_true_count = int(direct_cell.get("trueM1RowsCount") or direct_cell.get("rowsCount") or 0) if direct_cell else 0
        previous_mt5_count = int(direct_cell.get("mt5RowsCount") or previous_true_count) if direct_cell else previous_true_count
        sync_now = utc_now_iso()
        direct_write = append_ohlcv_part_v5(
            repair_rows,
            provider="mt5",
            symbol=symbol,
            mode="direct",
            timeframe="M1",
            store_root=root,
            source="store_v5_m1_recent_repair",
            deduplicate_existing_time=False,
            manifest_extra={
                **(direct_cell or {}),
                "mt5RowsCount": previous_mt5_count + len(repair_rows),
                "trueM1RowsCount": previous_true_count + len(repair_rows),
                "lastImportAt": sync_now,
                "lastGapRepairAt": sync_now,
                "lastGapRepairRows": len(repair_rows),
                "lastGapRepairGaps": len(gaps),
                "m1IntegrityStatus": "true_m1_recent_window_repaired",
                "status": "ready",
                "dirty": False,
                "updatedAt": sync_now,
            },
        )
        if int(direct_write.get("rowsWritten") or 0) > 0:
            mark_aggregated_dirty_for_symbol(root, provider="mt5", symbol=symbol)

        return {
            "ok": True,
            "status": "m1_gap_repair_completed",
            "symbol": symbol,
            "lookbackMinutes": lookback_minutes,
            "gapsDetected": len(gaps),
            "gaps": gaps,
            "rowsWritten": int(direct_write.get("rowsWritten") or 0),
            "rawRowsWritten": int(raw_write.get("rowsWritten") or 0),
            "firstRepairTime": min(repair_rows_by_time) if repair_rows_by_time else None,
            "lastRepairTime": max(repair_rows_by_time) if repair_rows_by_time else None,
            "publishedAt": utc_now_iso(),
        }
    finally:
        if initialized:
            try:
                mt5.shutdown()
            except Exception:
                pass
