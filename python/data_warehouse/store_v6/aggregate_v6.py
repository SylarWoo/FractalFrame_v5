from __future__ import annotations

import shutil
from math import ceil
from pathlib import Path
from typing import Any, Callable

import duckdb
import pandas as pd

from ..aggregate.aggregation_anchor_v1 import ANCHOR_UTC2200, FIXED_SECONDS, month_anchor_start, next_month_anchor, week_anchor_start
from .manifest_v6 import delete_dataset_cell, get_dataset_cell, load_manifest_v6, save_manifest_v6, utc_now_iso
from .paths_v6 import STORE_VERSION, dataset_key, dataset_root, resolve_store_root
from .schema_v6 import AGGREGATED_COLUMNS, bar_key, normalize_period
from .symbol_sessions_v6 import annotate_time_with_session_rule, read_symbol_session_rule_v6
from .writer_v6 import append_frame_v6

SUPPORTED_AGGREGATE_PERIODS = ["M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN"]


def _clean_m1_files(root: Path, symbol: str) -> list[str]:
    ds_root = dataset_root(provider="mt5", symbol=symbol, mode="clean", timeframe="M1", store_root=root)
    return sorted(str(path) for path in ds_root.rglob("part-*.parquet"))


def _read_clean_m1_window(root: Path, symbol: str, *, after_open_time: int | None, limit: int) -> pd.DataFrame:
    files = _clean_m1_files(root, symbol)
    if not files:
        return pd.DataFrame()
    con = duckdb.connect(database=":memory:")
    try:
        return con.execute(
            """
            WITH ranked AS (
              SELECT
                openTime, closeTime, open, high, low, close, volume, barKey,
                ROW_NUMBER() OVER (
                  PARTITION BY barKey
                  ORDER BY volume DESC, ABS(high - low) DESC, filename DESC
                ) AS row_rank
              FROM read_parquet(?, filename=true)
              WHERE quality = 'clean'
                AND (? IS NULL OR openTime > ?)
            )
            SELECT openTime, closeTime, open, high, low, close, volume, barKey
            FROM ranked
            WHERE row_rank = 1
            ORDER BY openTime
            LIMIT ?
            """,
            [files, after_open_time, after_open_time, limit],
        ).fetchdf()
    finally:
        con.close()


def _count_clean_m1_window(root: Path, symbol: str, *, after_open_time: int | None) -> int:
    files = _clean_m1_files(root, symbol)
    if not files:
        return 0
    con = duckdb.connect(database=":memory:")
    try:
        return int(con.execute(
            """
            WITH ranked AS (
              SELECT
                barKey,
                ROW_NUMBER() OVER (
                  PARTITION BY barKey
                  ORDER BY volume DESC, ABS(high - low) DESC, filename DESC
                ) AS row_rank
              FROM read_parquet(?, filename=true)
              WHERE quality = 'clean'
                AND (? IS NULL OR openTime > ?)
            )
            SELECT COUNT(*) AS rows_count
            FROM ranked
            WHERE row_rank = 1
            """,
            [files, after_open_time, after_open_time],
        ).fetchone()[0] or 0)
    finally:
        con.close()


def _dataset_parts_count(ds_root: Path) -> int:
    return len(list(ds_root.rglob("part-*.parquet"))) if ds_root.exists() else 0


def _dataset_time_bounds(ds_root: Path) -> tuple[int | None, int | None]:
    files = sorted(str(path) for path in ds_root.rglob("part-*.parquet")) if ds_root.exists() else []
    if not files:
        return None, None
    con = duckdb.connect(database=":memory:")
    try:
        row = con.execute("SELECT MIN(openTime), MAX(openTime) FROM read_parquet(?)", [files]).fetchone()
        return (None if row[0] is None else int(row[0]), None if row[1] is None else int(row[1]))
    finally:
        con.close()


def _delete_aggregated_tail(
    root: Path,
    *,
    symbol: str,
    period: str,
    anchor: str,
    cutoff_open_time: int,
    dataset_key_value: str,
) -> int:
    ds_root = dataset_root(provider="mt5", symbol=symbol, mode="aggregated", timeframe=period, base_timeframe="M1", anchor=anchor, store_root=root)
    if not ds_root.exists():
        return 0
    deleted = 0
    for file in sorted(ds_root.rglob("part-*.parquet")):
        frame = pd.read_parquet(file)
        if frame.empty or "openTime" not in frame.columns:
            continue
        keep = frame[frame["openTime"] < int(cutoff_open_time)]
        deleted += len(frame) - len(keep)
        if len(keep) == len(frame):
            continue
        if keep.empty:
            file.unlink(missing_ok=True)
            continue
        tmp = file.with_suffix(".parquet.tmp")
        keep.to_parquet(tmp, index=False, engine="pyarrow")
        tmp.replace(file)
    if deleted:
        manifest = load_manifest_v6(root)
        cell = manifest.get("datasets", {}).get(dataset_key_value)
        if cell is not None:
            first_time, last_time = _dataset_time_bounds(ds_root)
            cell["rowsCount"] = max(0, int(cell.get("rowsCount") or 0) - deleted)
            cell["partsCount"] = _dataset_parts_count(ds_root)
            cell["firstOpenTime"] = first_time
            cell["lastOpenTime"] = last_time
            cell["firstTime"] = first_time
            cell["lastTime"] = last_time
            cell["dirty"] = True
            save_manifest_v6(manifest, root)
    return deleted


def _finalize_aggregated_cell(
    root: Path,
    *,
    dataset_key_value: str,
    ds_root: Path,
    clean_cell: dict[str, Any],
) -> dict[str, Any]:
    manifest = load_manifest_v6(root)
    cell = manifest.get("datasets", {}).get(dataset_key_value, {})
    first_time, last_time = _dataset_time_bounds(ds_root)
    cell.update({
        "rowsCount": cell.get("rowsCount") or 0,
        "partsCount": _dataset_parts_count(ds_root),
        "firstOpenTime": first_time,
        "lastOpenTime": last_time,
        "firstTime": first_time,
        "lastTime": last_time,
        "sourceLastTime": clean_cell.get("lastOpenTime"),
        "sourceTrueM1RowsCount": clean_cell.get("rowsCount"),
        "dirty": False,
        "lastAggregateAt": utc_now_iso(),
    })
    manifest.setdefault("datasets", {})[dataset_key_value] = cell
    save_manifest_v6(manifest, root)
    return cell


def _bucket_start(value: int, period: str, anchor: str) -> int:
    if period == "MN":
        return month_anchor_start(value, anchor)
    if period == "W1":
        return week_anchor_start(value, anchor)
    seconds = int(FIXED_SECONDS[period])
    offset = 22 * 3600 if anchor == ANCHOR_UTC2200 else 0
    return ((int(value) - offset) // seconds) * seconds + offset


def _period_seconds(period: str, bucket_open: int, next_bucket_open: int | None = None, anchor: str = ANCHOR_UTC2200) -> int:
    if period == "MN" and next_bucket_open is not None:
        return int(next_bucket_open) - int(bucket_open)
    if period == "MN":
        return int(next_month_anchor(bucket_open, anchor)) - int(bucket_open)
    return int(FIXED_SECONDS.get(period, 0) or 0)


def _aggregate(df: pd.DataFrame, *, symbol: str, period: str, anchor: str, global_index_start: int = 0, session_rule: dict[str, Any] | None = None) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=AGGREGATED_COLUMNS)
    work = df.sort_values("openTime").copy()
    work["bucket"] = work["openTime"].map(lambda value: _bucket_start(int(value), period, anchor))
    grouped = work.groupby("bucket", sort=True, observed=True)
    out = grouped.agg(
        open=("open", "first"),
        high=("high", "max"),
        low=("low", "min"),
        close=("close", "last"),
        volume=("volume", "sum"),
        sourceBars=("openTime", "size"),
        sourceFromOpenTime=("openTime", "min"),
        sourceToOpenTime=("openTime", "max"),
    ).reset_index(drop=False).rename(columns={"bucket": "openTime"})
    out["openTime"] = out["openTime"].astype("int64")
    out["period"] = period
    out["symbol"] = symbol
    out["timestamp"] = out["openTime"]
    out["barKey"] = out["openTime"].map(lambda value: bar_key(symbol, period, int(value)))
    out["globalIndex"] = range(global_index_start, global_index_start + len(out))
    annotations = [annotate_time_with_session_rule(symbol, int(value), session_rule) for value in out["openTime"].tolist()]
    out["sessionRuleId"] = [item.get("sessionRuleId") for item in annotations]
    out["sessionRuleVersion"] = [item.get("sessionRuleVersion") for item in annotations]
    out["sessionId"] = [item.get("sessionId") for item in annotations]
    out["tradingDay"] = [item.get("tradingDay") for item in annotations]
    out["sessionState"] = [item.get("sessionState") for item in annotations]
    out["isTradingTime"] = [item.get("isTradingTime") for item in annotations]
    out["sourcePeriod"] = "M1"
    if period == "MN":
        out["expectedSourceBars"] = out["openTime"].map(lambda value: _period_seconds(period, int(value), anchor=anchor) // 60)
    else:
        out["expectedSourceBars"] = int(FIXED_SECONDS[period] // 60)
    out["completeness"] = out.apply(lambda row: "complete" if int(row["sourceBars"]) >= int(row["expectedSourceBars"]) else "incomplete", axis=1)
    if period == "MN":
        out["closeTime"] = out["openTime"].map(lambda value: next_month_anchor(int(value), anchor))
    else:
        out["closeTime"] = out["openTime"] + int(FIXED_SECONDS[period])
    now = utc_now_iso()
    out["createdAt"] = now
    out["updatedAt"] = now
    out["volume"] = out["volume"].astype("int64")
    return out[AGGREGATED_COLUMNS]


ProgressCallback = Callable[..., None]
CancelCallback = Callable[[], bool]


def _split_ready_and_carry(frame: pd.DataFrame, *, period: str, anchor: str, is_final_window: bool) -> tuple[pd.DataFrame, pd.DataFrame]:
    if frame.empty or is_final_window:
        return frame, pd.DataFrame(columns=frame.columns)
    work = frame.sort_values("openTime").copy()
    work["_bucket"] = work["openTime"].map(lambda value: _bucket_start(int(value), period, anchor))
    carry_bucket = int(work["_bucket"].max())
    ready = work[work["_bucket"] != carry_bucket].drop(columns=["_bucket"])
    carry = work[work["_bucket"] == carry_bucket].drop(columns=["_bucket"])
    return ready, carry


def aggregate_from_m1_store_v6(
    *,
    symbol: str,
    target_timeframes: list[str],
    store_root: str | Path | None = None,
    anchor: str = ANCHOR_UTC2200,
    rebuild: bool = False,
    batch_source_rows: int = 20_000,
    progress: ProgressCallback | None = None,
    is_cancelled: CancelCallback | None = None,
) -> dict[str, Any]:
    root = resolve_store_root(store_root)
    clean_key = dataset_key(provider="mt5", symbol=symbol, mode="clean", timeframe="M1")
    clean_cell = get_dataset_cell(root, clean_key)
    if not clean_cell:
        return {"ok": False, "error": "clean_m1_missing", "symbol": symbol, "storeVersion": STORE_VERSION}
    if not _clean_m1_files(root, symbol):
        return {"ok": False, "error": "clean_m1_empty", "symbol": symbol, "storeVersion": STORE_VERSION}
    results: dict[str, Any] = {}
    normalized_targets = [normalize_period(item) for item in target_timeframes]
    total_periods = len(normalized_targets)
    source_total_rows = int(clean_cell.get("rowsCount") or 0)
    if source_total_rows <= 0:
        return {"ok": False, "error": "clean_m1_empty", "symbol": symbol, "storeVersion": STORE_VERSION}
    batch_source_rows = max(1, int(batch_source_rows or 20_000))
    session_rule = read_symbol_session_rule_v6(symbol, store_root=root)
    for period_index, period in enumerate(normalized_targets):
        if is_cancelled and is_cancelled():
            return {"ok": False, "cancelled": True, "symbol": symbol, "storeVersion": STORE_VERSION, "results": results}
        if period not in SUPPORTED_AGGREGATE_PERIODS:
            results[period] = {"ok": False, "error": "unsupported_timeframe"}
            continue
        if progress:
            progress(
                phase="running",
                status="store_v6_aggregate_running",
                currentPeriod=period,
                completed=period_index,
                total=total_periods,
                progressPercent=round((period_index / max(1, total_periods)) * 100, 2),
                progressLabel=f"Aggregating {period}: building identity-indexed bars from M1",
                aggregateBatchSize=batch_source_rows,
                sourceRowsProcessed=0,
                sourceRowsTotal=0,
                sessionRuleId=(session_rule or {}).get("ruleId"),
                sessionRuleVersion=(session_rule or {}).get("ruleVersion"),
            )
        aggr_root = dataset_root(provider="mt5", symbol=symbol, mode="aggregated", timeframe=period, base_timeframe="M1", anchor=anchor, store_root=root)
        aggr_key = dataset_key(provider="mt5", symbol=symbol, mode="aggregated", timeframe=period, base_timeframe="M1", anchor=anchor)
        existing_cell = get_dataset_cell(root, aggr_key)
        clean_last_time = clean_cell.get("lastOpenTime")
        existing_source_last_time = existing_cell.get("sourceLastTime") if existing_cell else None
        existing_last_time = existing_cell.get("lastOpenTime") if existing_cell else None
        existing_rows = existing_cell.get("rowsCount") if existing_cell else None
        expected_last_bucket = _bucket_start(clean_last_time, period, anchor) if isinstance(clean_last_time, int) else None
        if (
            not rebuild
            and existing_cell
            and not existing_cell.get("dirty")
            and isinstance(existing_rows, int)
            and existing_rows > 0
            and isinstance(clean_last_time, int)
            and isinstance(existing_source_last_time, int)
            and isinstance(existing_last_time, int)
            and existing_source_last_time >= clean_last_time
            and isinstance(expected_last_bucket, int)
            and existing_last_time >= expected_last_bucket
        ):
            results[period] = {
                "ok": True,
                "skipped": True,
                "reason": "aggregated_period_is_up_to_date",
                "rowsCount": existing_rows,
                "sourceLastTime": existing_source_last_time,
                "sourceTrueM1RowsCount": existing_cell.get("sourceTrueM1RowsCount"),
                "anchor": anchor,
                "dirty": False,
            }
            if progress:
                progress(
                    phase="running",
                    status="store_v6_aggregate_running",
                    currentPeriod=period,
                    completed=period_index + 1,
                    total=total_periods,
                    progressPercent=round(((period_index + 1) / max(1, total_periods)) * 100, 2),
                    progressLabel=f"Skipped {period}: already up to date",
                    aggregateBatchSize=batch_source_rows,
                    sourceRowsProcessed=source_total_rows,
                    sourceRowsTotal=source_total_rows,
                    sessionRuleId=(session_rule or {}).get("ruleId"),
                    sessionRuleVersion=(session_rule or {}).get("ruleVersion"),
            )
            continue
        incremental_cursor: int | None = None
        aggregate_rows_seen = 0
        tail_deleted_rows = 0
        if not rebuild and existing_cell and isinstance(existing_rows, int) and existing_rows > 0:
            candidates = [
                value
                for value in [existing_source_last_time, existing_cell.get("lastOpenTime")]
                if isinstance(value, int)
            ]
            if candidates:
                tail_anchor_time = min(candidates)
                cutoff_open_time = _bucket_start(tail_anchor_time, period, anchor)
                tail_deleted_rows = _delete_aggregated_tail(
                    root,
                    symbol=symbol,
                    period=period,
                    anchor=anchor,
                    cutoff_open_time=cutoff_open_time,
                    dataset_key_value=aggr_key,
                )
                incremental_cursor = cutoff_open_time - 1
                refreshed_cell = get_dataset_cell(root, aggr_key) or {}
                aggregate_rows_seen = int(refreshed_cell.get("rowsCount") or 0)
        if rebuild and aggr_root.exists():
            shutil.rmtree(aggr_root)
        if rebuild:
            delete_dataset_cell(root, aggr_key)
        period_source_total_rows = _count_clean_m1_window(root, symbol, after_open_time=incremental_cursor)
        estimated_batches = max(1, ceil(max(1, period_source_total_rows) / batch_source_rows))
        rows_written = 0
        source_processed = 0
        cursor: int | None = incremental_cursor
        carry = pd.DataFrame()
        write: dict[str, Any] = {"manifestCell": {}}
        batch_index = 0
        if progress and incremental_cursor is not None:
            progress(
                phase="running",
                status="store_v6_aggregate_running",
                currentPeriod=period,
                completed=period_index,
                total=total_periods,
                progressPercent=round((period_index / max(1, total_periods)) * 100, 2),
                progressLabel=f"Aggregating {period}: tail update from {incremental_cursor + 1}, deleted {tail_deleted_rows:,} old bars",
                aggregateBatchSize=batch_source_rows,
                currentBatchIndex=0,
                currentBatchTotal=estimated_batches,
                sourceRowsProcessed=0,
                sourceRowsTotal=period_source_total_rows,
                rowsWritten=rows_written,
            )
        while True:
            if is_cancelled and is_cancelled():
                return {"ok": False, "cancelled": True, "symbol": symbol, "storeVersion": STORE_VERSION, "results": results}
            batch_index += 1
            source_window = _read_clean_m1_window(root, symbol, after_open_time=cursor, limit=batch_source_rows)
            is_final_window = len(source_window) < batch_source_rows
            if source_window.empty:
                if carry.empty:
                    break
                combined = carry
                carry = pd.DataFrame()
                is_final_window = True
            else:
                cursor = int(source_window["openTime"].max())
                source_processed += len(source_window)
                combined = pd.concat([carry, source_window], ignore_index=True) if not carry.empty else source_window
            ready_source, carry = _split_ready_and_carry(combined, period=period, anchor=anchor, is_final_window=is_final_window)
            if ready_source.empty:
                if is_final_window:
                    break
                if progress:
                    period_fraction = min(1.0, source_processed / max(1, period_source_total_rows))
                    progress(
                        phase="running",
                        status="store_v6_aggregate_running",
                        currentPeriod=period,
                        completed=period_index,
                        total=total_periods,
                        progressPercent=round(((period_index + period_fraction) / max(1, total_periods)) * 100, 2),
                        progressLabel=f"Aggregating {period}: window {batch_index}/{estimated_batches}, carrying unfinished bucket",
                        aggregateBatchSize=batch_source_rows,
                        currentBatchIndex=batch_index,
                        currentBatchTotal=estimated_batches,
                        sourceRowsProcessed=source_processed,
                        sourceRowsTotal=period_source_total_rows,
                        rowsWritten=rows_written,
                    )
                continue
            chunk = _aggregate(ready_source, symbol=symbol, period=period, anchor=anchor, global_index_start=aggregate_rows_seen, session_rule=session_rule)
            aggregate_rows_seen += len(chunk)
            write = append_frame_v6(
                chunk,
                provider="mt5",
                symbol=symbol,
                mode="aggregated",
                timeframe=period,
                base_timeframe="M1",
                anchor=anchor,
                store_root=root,
                manifest_extra={
                    "sourceDataset": clean_key,
                    "sourceFirstTime": clean_cell.get("firstOpenTime"),
                    "sourceLastTime": cursor,
                    "sourceTrueM1RowsCount": clean_cell.get("rowsCount"),
                    "lastAggregateAt": utc_now_iso(),
                    "lastAggregateMode": "rebuild" if rebuild else "append",
                    "lastAggregateBatchIndex": batch_index,
                    "lastAggregateCursorOpenTime": cursor,
                    "aggregationReadMode": "duckdb_stream_window",
                    "aggregateBatchSourceRows": batch_source_rows,
                    "sessionRuleId": (session_rule or {}).get("ruleId"),
                    "sessionRuleVersion": (session_rule or {}).get("ruleVersion"),
                    "status": "ready",
                    "dirty": False,
                },
                deduplicate_existing_key=not rebuild,
            )
            rows_written += int(write.get("rowsWritten") or 0)
            if progress:
                period_fraction = min(1.0, source_processed / max(1, period_source_total_rows))
                progress(
                    phase="running",
                    status="store_v6_aggregate_running",
                    currentPeriod=period,
                    completed=period_index,
                    total=total_periods,
                    progressPercent=round(((period_index + period_fraction) / max(1, total_periods)) * 100, 2),
                    progressLabel=f"Aggregating {period}: window {batch_index}/{estimated_batches}, source M1 {source_processed:,}/{period_source_total_rows:,}",
                    aggregateBatchSize=batch_source_rows,
                    currentBatchIndex=batch_index,
                    currentBatchTotal=estimated_batches,
                    sourceRowsProcessed=source_processed,
                    sourceRowsTotal=period_source_total_rows,
                    rowsWritten=rows_written,
                )
            if is_final_window:
                break
        final_cell = _finalize_aggregated_cell(root, dataset_key_value=aggr_key, ds_root=aggr_root, clean_cell=clean_cell)
        results[period] = {
            "ok": True,
            "rowsCount": final_cell.get("rowsCount") or write.get("manifestCell", {}).get("rowsCount"),
            "rowsWritten": rows_written,
            "sourceLastTime": clean_cell.get("lastOpenTime"),
            "sourceTrueM1RowsCount": clean_cell.get("rowsCount"),
            "anchor": anchor,
            "readMode": "duckdb_stream_window",
            "batchSourceRows": batch_source_rows,
            "sessionRuleId": (session_rule or {}).get("ruleId"),
            "sessionRuleVersion": (session_rule or {}).get("ruleVersion"),
            "dirty": False,
        }
        if progress:
            progress(
                phase="running",
                status="store_v6_aggregate_running",
                currentPeriod=period,
                completed=period_index + 1,
                total=total_periods,
                progressPercent=round(((period_index + 1) / max(1, total_periods)) * 100, 2),
                progressLabel=f"Aggregated {period}: {rows_written:,} rows written",
                aggregateBatchSize=batch_source_rows,
                sourceRowsProcessed=source_total_rows,
                sourceRowsTotal=period_source_total_rows,
            )
    return {"ok": True, "symbol": symbol, "storeVersion": STORE_VERSION, "results": results}
