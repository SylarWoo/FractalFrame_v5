from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .mt5_m1_check_service import mt5_rates_to_rows
from .store_v5_pull_context import StoreV5PullContext
from .store_v5_pull_job_state import get_pull_job, read_progress, set_pull_job, write_progress
from .store_v5_pull_write_service import flush_pending_rows
from .store_v5_status_service import format_utc_text, utc_now_iso


def _cancel_if_requested(job_id: str, ctx: StoreV5PullContext) -> bool:
    job = get_pull_job(job_id)
    if not job or not job.get("cancelRequested"):
        return False
    set_pull_job(
        job_id,
        ok=False,
        phase="cancelled",
        status="store_v5_pull_cancelled",
        rowsFetched=ctx.rows_fetched_total,
        rowsWritten=ctx.rows_written_total,
        rawRowsCount=ctx.rows_written_total,
        duplicateRows=ctx.duplicate_rows_total,
        progressLabel="Cancelled",
        detailMessage="User cancelled StoreV5 pull job",
        finishedAt=utc_now_iso(),
    )
    return True


def _filter_new_rows(ctx: StoreV5PullContext, part: list[dict[str, Any]]) -> list[dict[str, Any]]:
    new_part: list[dict[str, Any]] = []
    for row in part:
        row_time = int(row.get("time") or 0)
        if row_time <= 0 or row_time in ctx.seen_times:
            ctx.duplicate_rows_total += 1
            continue
        ctx.seen_times.add(row_time)
        if not ctx.keep_incremental_row(row_time):
            ctx.duplicate_rows_total += 1
            continue
        new_part.append(row)
    return new_part


def _append_new_rows(ctx: StoreV5PullContext, new_part: list[dict[str, Any]], *, mt5_row_to_canonical: Any, symbol: str) -> None:
    if not new_part:
        return
    canonical_batch = [mt5_row_to_canonical(row, provider="mt5", symbol=symbol, timeframe="M1") for row in new_part]
    ctx.add_canonical_batch(canonical_batch)


def fetch_store_v5_raw_m1(
    ctx: StoreV5PullContext,
    *,
    append_ohlcv_part_v5: Any,
    job_id: str,
    mt5: Any,
    mt5_row_to_canonical: Any,
    symbol: str,
) -> bool:
    if ctx.range_window is not None:
        return _fetch_incremental_range(
            ctx,
            append_ohlcv_part_v5=append_ohlcv_part_v5,
            job_id=job_id,
            mt5=mt5,
            mt5_row_to_canonical=mt5_row_to_canonical,
            symbol=symbol,
        )

    return _fetch_initial_forward(
        ctx,
        append_ohlcv_part_v5=append_ohlcv_part_v5,
        job_id=job_id,
        mt5=mt5,
        mt5_row_to_canonical=mt5_row_to_canonical,
        symbol=symbol,
    )


def _rates_from_pos_rows(mt5: Any, symbol: str, start_pos: int, count: int) -> list[dict[str, Any]]:
    rows = mt5_rates_to_rows(mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, start_pos, count))
    return sorted(rows, key=lambda row: int(row.get("time") or 0))


def _probe_available_bars(ctx: StoreV5PullContext, *, job_id: str, mt5: Any, symbol: str) -> int:
    if ctx.target is not None:
        return ctx.target

    set_pull_job(
        job_id,
        phase="locating_start",
        status="store_v6_pull_locating_history_head",
        currentAction="probe_mt5_history_depth",
        progressPercent=None,
        rowsFetched=ctx.rows_fetched_total,
        rowsWritten=ctx.rows_written_total,
        rawRowsCount=ctx.rows_written_total,
        duplicateRows=ctx.duplicate_rows_total,
        chunksCompleted=ctx.chunks,
        fetchChunkSize=ctx.step,
        maxCount=ctx.target,
        progressLabel="正在定位起点：计算 MT5 最早可用 M1",
        detailMessage="Probing MT5 M1 history depth before forward sequential pull",
    )

    low = 0
    high = max(1, ctx.step)
    while mt5_rates_to_rows(mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, high, 1)):
        if _cancel_if_requested(job_id, ctx):
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


def _fetch_initial_forward(
    ctx: StoreV5PullContext,
    *,
    append_ohlcv_part_v5: Any,
    job_id: str,
    mt5: Any,
    mt5_row_to_canonical: Any,
    symbol: str,
) -> bool:
    total_available = _probe_available_bars(ctx, job_id=job_id, mt5=mt5, symbol=symbol)
    if total_available <= 0:
        return not bool((get_pull_job(job_id) or {}).get("cancelRequested"))
    ctx.available_bars = total_available
    ctx.target = total_available

    remaining = total_available
    while remaining > 0:
        if _cancel_if_requested(job_id, ctx):
            return False
        want = min(ctx.step, remaining)
        start_pos = remaining - want
        if not _fetch_position_window(
            ctx,
            append_ohlcv_part_v5=append_ohlcv_part_v5,
            job_id=job_id,
            mt5=mt5,
            mt5_row_to_canonical=mt5_row_to_canonical,
            start_pos=start_pos,
            symbol=symbol,
            want=want,
        ):
            break
        remaining -= want
    return True


def _fetch_incremental_range(
    ctx: StoreV5PullContext,
    *,
    append_ohlcv_part_v5: Any,
    job_id: str,
    mt5: Any,
    mt5_row_to_canonical: Any,
    symbol: str,
) -> bool:
    assert ctx.range_window is not None
    from_time = int(ctx.range_window["fromTime"])
    to_time = int(ctx.range_window["toTime"])
    if from_time > to_time:
        set_pull_job(
            job_id,
            phase="completed",
            status="store_v6_pull_already_at_latest",
            currentAction="incremental_noop",
            progressPercent=100,
            rowsFetched=0,
            rowsWritten=0,
            rawRowsCount=0,
            duplicateRows=0,
            chunksCompleted=0,
            fetchChunkSize=ctx.step,
            maxCount=0,
            currentBatchIndex=0,
            currentBatchRequested=0,
            currentBatchFetched=0,
            writeBatchRows=0,
            writeBatchWritten=0,
            pendingWriteRows=0,
            cleanStatus="ready",
            progressLabel="拉取完成，仓库已推进到最新",
            detailMessage="No new M1 range after current Clean tail",
        )
        return True

    current_from = from_time
    batch_seconds = max(60, ctx.step * 60)
    batch_index = 0
    ctx.target = max(1, ((to_time - from_time) // 60) + 1)
    while current_from <= to_time:
        if _cancel_if_requested(job_id, ctx):
            return False
        batch_index += 1
        current_to = min(to_time, current_from + batch_seconds - 1)
        _fetch_incremental_time_window(
            ctx,
            batch_index=batch_index,
            current_from=current_from,
            current_to=current_to,
            job_id=job_id,
            mt5=mt5,
            mt5_row_to_canonical=mt5_row_to_canonical,
            symbol=symbol,
        )
        if len(ctx.pending_rows) >= ctx.write_buffer_target:
            flush_pending_rows(ctx, append_ohlcv_part_v5=append_ohlcv_part_v5, job_id=job_id, symbol=symbol)
        current_from = current_to + 1
    return True


def _fetch_incremental_time_window(
    ctx: StoreV5PullContext,
    *,
    batch_index: int,
    current_from: int,
    current_to: int,
    job_id: str,
    mt5: Any,
    mt5_row_to_canonical: Any,
    symbol: str,
) -> None:
    set_pull_job(
        job_id,
        phase="fetching",
        status="store_v5_pull_raw_m1_incremental_requesting",
        currentAction="copy_rates_range",
        progressPercent=read_progress(ctx.rows_fetched_total, ctx.chunks, ctx.target),
        rowsFetched=ctx.rows_fetched_total,
        rowsWritten=0,
        rawRowsCount=0,
        duplicateRows=0,
        chunksCompleted=ctx.chunks,
        fetchChunkSize=ctx.step,
        maxCount=ctx.target,
        currentBatchIndex=batch_index,
        currentBatchRequested=ctx.step,
        currentBatchFetched=0,
        writeBatchRows=0,
        writeBatchWritten=0,
        pendingWriteRows=0,
        cleanStatus="pending",
        progressLabel=f"正在从 MT5 读取：本批 {ctx.step:,} 根",
        detailMessage=f"Incremental M1 range {format_utc_text(current_from)} to {format_utc_text(current_to)}",
    )
    rates = mt5.copy_rates_range(
        symbol,
        mt5.TIMEFRAME_M1,
        datetime.fromtimestamp(current_from, tz=timezone.utc),
        datetime.fromtimestamp(current_to, tz=timezone.utc),
    )
    part = sorted(mt5_rates_to_rows(rates), key=lambda row: int(row.get("time") or 0))
    ctx.rows_fetched_total += len(part)
    ctx.chunks += 1
    new_part = _filter_new_rows(ctx, part)
    _append_new_rows(ctx, new_part, mt5_row_to_canonical=mt5_row_to_canonical, symbol=symbol)
    set_pull_job(
        job_id,
        phase="building_identity",
        status="store_v5_pull_raw_m1_incremental_fetched",
        currentAction="copy_rates_range_done",
        progressPercent=read_progress(ctx.rows_fetched_total, ctx.chunks, ctx.target),
        rowsFetched=ctx.rows_fetched_total,
        rowsWritten=ctx.rows_written_total,
        rawRowsCount=ctx.rows_written_total,
        duplicateRows=ctx.duplicate_rows_total,
        chunksCompleted=batch_index,
        fetchChunkSize=ctx.step,
        maxCount=ctx.target,
        currentBatchIndex=batch_index,
        currentBatchRequested=ctx.step,
        currentBatchFetched=len(part),
        writeBatchRows=len(new_part),
        writeBatchWritten=0,
        pendingWriteRows=len(ctx.pending_rows),
        firstTimeText=format_utc_text(ctx.first_time),
        lastTimeText=format_utc_text(ctx.last_time),
        cleanStatus="pending",
        progressLabel="正在生成 K 线身份 ID",
        detailMessage=f"MT5 returned {len(part):,}, new candidates {len(new_part):,}, skipped {ctx.duplicate_rows_total:,}",
    )


def _fetch_position_window(
    ctx: StoreV5PullContext,
    *,
    append_ohlcv_part_v5: Any,
    job_id: str,
    mt5: Any,
    mt5_row_to_canonical: Any,
    start_pos: int,
    symbol: str,
    want: int,
) -> bool:
    current_batch_index = ctx.chunks + 1
    set_pull_job(
        job_id,
        phase="fetching",
        status="store_v5_pull_raw_m1_requesting",
        currentAction="copy_rates_from_pos",
        progressPercent=read_progress(ctx.rows_fetched_total, ctx.chunks, ctx.target),
        rowsFetched=ctx.rows_fetched_total,
        rowsWritten=ctx.rows_written_total,
        rawRowsCount=ctx.rows_written_total,
        duplicateRows=ctx.duplicate_rows_total,
        chunksCompleted=ctx.chunks,
        fetchChunkSize=ctx.step,
        maxCount=ctx.target,
        currentBatchIndex=current_batch_index,
        currentBatchRequested=want,
        currentBatchFetched=0,
        writeBatchRows=0,
        writeBatchWritten=0,
        pendingWriteRows=len(ctx.pending_rows),
        firstTimeText=format_utc_text(ctx.first_time),
        lastTimeText=format_utc_text(ctx.last_time),
        cleanStatus="pending",
        progressLabel=f"正在从 MT5 读取：本批 {want:,} 根",
        detailMessage=f"Forward sequential M1 pull from MT5 position {start_pos:,}",
    )
    part = _rates_from_pos_rows(mt5, symbol, start_pos, want)
    if not part:
        return False
    ctx.pos = start_pos
    ctx.rows_fetched_total += len(part)
    new_part = _filter_new_rows(ctx, part)
    _append_new_rows(ctx, new_part, mt5_row_to_canonical=mt5_row_to_canonical, symbol=symbol)
    if len(ctx.pending_rows) >= ctx.write_buffer_target:
        flush_pending_rows(ctx, append_ohlcv_part_v5=append_ohlcv_part_v5, job_id=job_id, symbol=symbol)
    ctx.chunks += 1
    set_pull_job(
        job_id,
        phase="building_identity",
        status="store_v5_pull_raw_m1_streaming",
        currentAction="copy_rates_from_pos_buffer_raw_direct_m1",
        progressPercent=read_progress(ctx.rows_fetched_total, ctx.chunks, ctx.target),
        rowsFetched=ctx.rows_fetched_total,
        rowsWritten=ctx.rows_written_total,
        rawRowsCount=ctx.rows_written_total,
        duplicateRows=ctx.duplicate_rows_total,
        chunksCompleted=ctx.chunks,
        fetchChunkSize=ctx.step,
        maxCount=ctx.target,
        currentBatchIndex=current_batch_index,
        currentBatchRequested=want,
        currentBatchFetched=len(part),
        writeBatchRows=len(new_part),
        writeBatchWritten=ctx.rows_written_total,
        pendingWriteRows=len(ctx.pending_rows),
        firstTimeText=format_utc_text(ctx.first_time),
        lastTimeText=format_utc_text(ctx.last_time),
        cleanStatus="pending",
        progressLabel="正在生成 K 线身份 ID",
        detailMessage=f"Batch {current_batch_index}: MT5 returned {len(part):,}, new candidates {len(new_part):,}",
    )
    return True
