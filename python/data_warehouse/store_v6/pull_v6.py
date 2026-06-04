from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from scripts.http_bridge.mt5_m1_rows import mt5_rates_to_rows

from .manifest_v6 import get_dataset_cell, mark_aggregated_dirty_for_symbol, utc_now_iso
from .paths_v6 import STORE_VERSION, dataset_key, manifest_path, resolve_store_root
from .schema_v6 import mt5_row_to_raw, raw_to_clean_rows
from .symbol_sessions_v6 import annotate_time_with_session_rule, read_symbol_session_rule_v6
from .writer_v6 import append_frame_v6, append_raw_rows_v6
import pandas as pd


ProgressFn = Callable[..., None]
CancelFn = Callable[[], bool]


def _fetch_position_rows_forward(mt5: Any, symbol: str, start_pos: int, count: int) -> list[dict[str, Any]]:
    rows = mt5_rates_to_rows(mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, start_pos, count))
    return sorted(rows, key=lambda row: int(row.get("time") or 0))


def _probe_available_bars(mt5: Any, symbol: str, *, batch_size: int, is_cancelled: CancelFn | None = None) -> int:
    low = 0
    high = max(1, int(batch_size))
    while mt5_rates_to_rows(mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, high, 1)):
        if is_cancelled and is_cancelled():
            return 0
        low = high
        high *= 2
    while low + 1 < high:
        mid = (low + high) // 2
        if mt5_rates_to_rows(mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, mid, 1)):
            low = mid
        else:
            high = mid
    return low + 1


def _fetch_range_rows(mt5: Any, symbol: str, from_time: int, to_time: int) -> list[dict[str, Any]]:
    rows = mt5_rates_to_rows(
        mt5.copy_rates_range(
            symbol,
            mt5.TIMEFRAME_M1,
            datetime.fromtimestamp(int(from_time), tz=timezone.utc),
            datetime.fromtimestamp(int(to_time), tz=timezone.utc),
        )
    )
    return sorted(rows, key=lambda row: int(row.get("time") or 0))


def _latest_closed_m1_open_time(now_ts: int | None = None) -> int:
    ts = int(now_ts) if now_ts is not None else int(datetime.now(timezone.utc).timestamp())
    return (ts // 60) * 60 - 60


def pull_mt5_m1_to_store_v6(
    *,
    symbol: str,
    mode: str = "incremental",
    count: int | None = None,
    store_root: str | Path | None = None,
    mt5_module: Any | None = None,
    batch_size: int = 20_000,
    pull_job_id: str | None = None,
    progress: ProgressFn | None = None,
    is_cancelled: CancelFn | None = None,
    current_time: int | None = None,
) -> dict[str, Any]:
    root = resolve_store_root(store_root)
    raw_key = dataset_key(provider="mt5", symbol=symbol, mode="raw", timeframe="M1")
    clean_key = dataset_key(provider="mt5", symbol=symbol, mode="clean", timeframe="M1")
    clean_cell = get_dataset_cell(root, clean_key)
    raw_cell = get_dataset_cell(root, raw_key)
    incremental = mode != "refresh" and clean_cell and clean_cell.get("lastOpenTime") is not None
    session_rule = read_symbol_session_rule_v6(symbol, store_root=root)

    def emit(**updates: Any) -> None:
        if progress:
            progress(**updates)

    if incremental:
        next_open_time = int(clean_cell["lastOpenTime"]) + 60
        latest_closed_time = _latest_closed_m1_open_time(current_time)
        if next_open_time > latest_closed_time:
            emit(
                phase="completed",
                status="store_v6_pull_no_new_closed_m1",
                progressPercent=100,
                progressLabel="没有新的已闭合 M1，跳过 MT5 拉取",
                detailMessage="StoreV6 Clean M1 is already at the latest closed minute",
                rowsFetched=0,
                rowsWritten=0,
            )
            return {
                "ok": True,
                "status": "store_v6_pull_no_new_closed_m1",
                "symbol": symbol,
                "storeVersion": STORE_VERSION,
                "importMode": "incremental",
                "mt5RowsCount": 0,
                "rawRowsCount": 0,
                "rowsWritten": 0,
                "duplicateRows": 0,
                "rejectedRows": 0,
                "firstRawM1Time": None,
                "lastRawM1Time": None,
                "manifestPath": str(manifest_path(root)),
                "sessionRuleId": (session_rule or {}).get("ruleId"),
                "sessionRuleVersion": (session_rule or {}).get("ruleVersion"),
                "noNewClosedM1": True,
                "nextOpenTime": next_open_time,
                "latestClosedTime": latest_closed_time,
            }

    mt5 = mt5_module
    initialized = False
    if mt5 is None:
        import MetaTrader5 as mt5  # type: ignore

        if not mt5.initialize():
            return {"ok": False, "status": "mt5_initialize_failed", "error": "mt5_initialize_failed", "symbol": symbol}
        initialized = True
        if not mt5.symbol_select(symbol, True):
            return {"ok": False, "status": "mt5_symbol_select_failed", "error": "mt5_symbol_select_failed", "symbol": symbol}

    rows_fetched = 0
    rows_raw_written = 0
    rows_clean_written = 0
    duplicate_rows = 0
    rejected_rows = 0
    chunks = 0
    first_time: int | None = None
    last_time: int | None = None

    def handle_rows(rows: list[dict[str, Any]]) -> None:
        nonlocal rows_fetched, rows_raw_written, rows_clean_written, duplicate_rows, rejected_rows, first_time, last_time
        if not rows:
            return
        pulled_at = utc_now_iso()
        raw_rows = []
        for row in rows:
            raw_row = mt5_row_to_raw(row, symbol=symbol, period="M1", pull_job_id=pull_job_id, pulled_at=pulled_at)
            raw_row.update(annotate_time_with_session_rule(symbol, int(raw_row["openTime"]), session_rule))
            raw_rows.append(raw_row)
        rows_fetched += len(raw_rows)
        batch_first = min(int(row["openTime"]) for row in raw_rows)
        batch_last = max(int(row["openTime"]) for row in raw_rows)
        first_time = batch_first if first_time is None else min(first_time, batch_first)
        last_time = batch_last if last_time is None else max(last_time, batch_last)
        emit(phase="building_identity", progressLabel="正在生成 K 线身份 ID", rowsFetched=rows_fetched)
        raw_write = append_raw_rows_v6(
            raw_rows,
            symbol=symbol,
            store_root=root,
            manifest_extra={
                "lastImportAt": pulled_at,
                "lastImportMode": mode,
                "lastPullMethod": "store_v6_sequential_forward",
                "lastPullChunkSize": batch_size,
                "sessionRuleId": (session_rule or {}).get("ruleId"),
                "sessionRuleVersion": (session_rule or {}).get("ruleVersion"),
            },
        )
        rows_raw_written += int(raw_write.get("rowsWritten") or 0)
        duplicate_rows += int(raw_write.get("duplicateRows") or 0)
        emit(phase="validating_grid", progressLabel="正在校验 M1 时间网格", rowsWritten=rows_raw_written, duplicateRows=duplicate_rows)
        clean_start_index = int((clean_cell or {}).get("rowsCount") or 0) + rows_clean_written
        clean_rows = raw_to_clean_rows(raw_rows, start_index=clean_start_index, session_rule=session_rule)
        rejected_rows += len(raw_rows) - len(clean_rows)
        emit(phase="writing_clean", progressLabel="正在写入 Clean Store", rejectedRows=rejected_rows)
        if clean_rows:
            clean_df = pd.DataFrame(clean_rows)
            clean_write = append_frame_v6(
                clean_df,
                provider="mt5",
                symbol=symbol,
                mode="clean",
                timeframe="M1",
                store_root=root,
                manifest_extra={
                    "sourceDataset": raw_key,
                    "sourceRawRowsCount": int((raw_cell or {}).get("rowsCount") or 0) + rows_raw_written,
                    "sourceRawLastTime": last_time,
                    "mt5RowsCount": int((clean_cell or {}).get("rowsCount") or 0) + rows_clean_written + len(clean_rows),
                    "trueM1RowsCount": int((clean_cell or {}).get("rowsCount") or 0) + rows_clean_written + len(clean_rows),
                    "lastTrueM1Time": int(clean_df["openTime"].max()),
                    "lastImportAt": pulled_at,
                    "lastCleanAt": pulled_at,
                    "m1IntegrityStatus": "true_m1_with_session_gaps" if any(row.get("gapBefore") == "missing" for row in clean_rows) else "true_m1_continuous",
                    "firstHourM1CheckOk": True,
                    "cleanStatus": "ready",
                    "sessionRuleId": (session_rule or {}).get("ruleId"),
                    "sessionRuleVersion": (session_rule or {}).get("ruleVersion"),
                },
                deduplicate_existing_key=True,
            )
            rows_clean_written += int(clean_write.get("rowsWritten") or 0)
            duplicate_rows += int(clean_write.get("duplicateRows") or 0)
        emit(phase="batch_completed", progressLabel="本批完成，准备下一批", rowsWritten=rows_clean_written)

    try:
        emit(
            phase="preparing",
            progressLabel="准备拉取：读取本地 session rule 和最后一根 clean M1",
            sessionRuleId=(session_rule or {}).get("ruleId"),
            sessionRuleVersion=(session_rule or {}).get("ruleVersion"),
        )
        if incremental:
            from_time = int(clean_cell["lastOpenTime"]) + 60
            to_time = _latest_closed_m1_open_time(current_time)
            if from_time <= to_time:
                step_seconds = max(60, int(batch_size) * 60)
                current_from = from_time
                while current_from <= to_time:
                    if is_cancelled and is_cancelled():
                        return {"ok": False, "status": "store_v6_pull_cancelled", "symbol": symbol, "cancelled": True}
                    current_to = min(to_time, current_from + step_seconds - 1)
                    chunks += 1
                    emit(phase="fetching", progressLabel=f"正在从 MT5 读取：本批 {batch_size:,} 根", currentBatchIndex=chunks)
                    handle_rows(_fetch_range_rows(mt5, symbol, current_from, current_to))
                    current_from = current_to + 1
        else:
            total = int(count) if count else _probe_available_bars(mt5, symbol, batch_size=batch_size, is_cancelled=is_cancelled)
            remaining = total
            while remaining > 0:
                if is_cancelled and is_cancelled():
                    return {"ok": False, "status": "store_v6_pull_cancelled", "symbol": symbol, "cancelled": True}
                want = min(int(batch_size), remaining)
                start_pos = remaining - want
                chunks += 1
                emit(phase="fetching", progressLabel=f"正在从 MT5 读取：本批 {want:,} 根", currentBatchIndex=chunks, maxCount=total)
                handle_rows(_fetch_position_rows_forward(mt5, symbol, start_pos, want))
                remaining -= want
    finally:
        if initialized:
            try:
                mt5.shutdown()
            except Exception:
                pass

    if rows_clean_written > 0:
        mark_aggregated_dirty_for_symbol(root, provider="mt5", symbol=symbol)
    return {
        "ok": True,
        "status": "store_v6_m1_pull_completed",
        "symbol": symbol,
        "storeVersion": STORE_VERSION,
        "importMode": "incremental" if incremental else "initial",
        "mt5RowsCount": rows_fetched,
        "rawRowsCount": rows_raw_written,
        "rowsWritten": rows_clean_written,
        "duplicateRows": duplicate_rows,
        "rejectedRows": rejected_rows,
        "firstRawM1Time": first_time,
        "lastRawM1Time": last_time,
        "manifestPath": str(manifest_path(root)),
        "sessionRuleId": (session_rule or {}).get("ruleId"),
        "sessionRuleVersion": (session_rule or {}).get("ruleVersion"),
    }
