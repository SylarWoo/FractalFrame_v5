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
        if _cancel_if_requested(job_id, ctx):
            return False
        _fetch_incremental_range(ctx, job_id=job_id, mt5=mt5, mt5_row_to_canonical=mt5_row_to_canonical, symbol=symbol)
        return True

    while ctx.target is None or ctx.pos < ctx.target:
        if _cancel_if_requested(job_id, ctx):
            return False
        if not _fetch_next_position_batch(
            ctx,
            append_ohlcv_part_v5=append_ohlcv_part_v5,
            job_id=job_id,
            mt5=mt5,
            mt5_row_to_canonical=mt5_row_to_canonical,
            symbol=symbol,
        ):
            break
    return True


def _fetch_incremental_range(
    ctx: StoreV5PullContext,
    *,
    job_id: str,
    mt5: Any,
    mt5_row_to_canonical: Any,
    symbol: str,
) -> None:
    assert ctx.range_window is not None
    from_time = int(ctx.range_window["fromTime"])
    to_time = int(ctx.range_window["toTime"])
    set_pull_job(
        job_id,
        phase="fetching",
        status="store_v5_pull_raw_m1_incremental_requesting",
        currentAction="copy_rates_range",
        progressPercent=15,
        rowsFetched=0,
        rowsWritten=0,
        rawRowsCount=0,
        duplicateRows=0,
        chunksCompleted=0,
        fetchChunkSize=ctx.step,
        maxCount=ctx.target,
        currentBatchIndex=1,
        currentBatchRequested=0,
        currentBatchFetched=0,
        writeBatchRows=0,
        writeBatchWritten=0,
        pendingWriteRows=0,
        cleanStatus="pending",
        progressLabel=f"Incremental read: {format_utc_text(from_time)} to {format_utc_text(to_time)}",
        detailMessage="Reading incremental M1 from MT5 with StoreV5 lastTime overlap",
    )
    rates = mt5.copy_rates_range(
        symbol,
        mt5.TIMEFRAME_M1,
        datetime.fromtimestamp(from_time, tz=timezone.utc),
        datetime.fromtimestamp(to_time, tz=timezone.utc),
    )
    part = mt5_rates_to_rows(rates)
    ctx.rows_fetched_total = len(part)
    ctx.chunks = 1 if part else 0
    new_part = _filter_new_rows(ctx, part)
    _append_new_rows(ctx, new_part, mt5_row_to_canonical=mt5_row_to_canonical, symbol=symbol)
    set_pull_job(
        job_id,
        phase="fetching",
        status="store_v5_pull_raw_m1_incremental_fetched",
        currentAction="copy_rates_range_done",
        progressPercent=65,
        rowsFetched=ctx.rows_fetched_total,
        rowsWritten=ctx.rows_written_total,
        rawRowsCount=ctx.rows_written_total,
        duplicateRows=ctx.duplicate_rows_total,
        chunksCompleted=ctx.chunks,
        fetchChunkSize=ctx.step,
        maxCount=ctx.target,
        currentBatchIndex=1,
        currentBatchRequested=0,
        currentBatchFetched=len(part),
        writeBatchRows=len(new_part),
        writeBatchWritten=0,
        pendingWriteRows=len(ctx.pending_rows),
        firstTimeText=format_utc_text(ctx.first_time),
        lastTimeText=format_utc_text(ctx.last_time),
        cleanStatus="pending",
        progressLabel=f"Incremental read done: MT5 returned {len(part):,}, new candidates {len(new_part):,}, skipped {ctx.duplicate_rows_total:,}",
        detailMessage="Filtered existing M1 using lastTime overlap",
    )


def _fetch_next_position_batch(
    ctx: StoreV5PullContext,
    *,
    append_ohlcv_part_v5: Any,
    job_id: str,
    mt5: Any,
    mt5_row_to_canonical: Any,
    symbol: str,
) -> bool:
    want = ctx.step if ctx.target is None else min(ctx.step, ctx.target - ctx.pos)
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
        progressLabel=f"Requesting batch {current_batch_index}: planned {want:,}, total read {ctx.rows_fetched_total:,}" + (f" / {ctx.target:,}" if ctx.target else ""),
        detailMessage="Waiting for MT5 M1 response",
    )
    part = mt5_rates_to_rows(mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, ctx.pos, want))
    if not part:
        return False
    ctx.pos += len(part)
    ctx.rows_fetched_total += len(part)
    new_part = _filter_new_rows(ctx, part)
    _append_new_rows(ctx, new_part, mt5_row_to_canonical=mt5_row_to_canonical, symbol=symbol)
    if len(ctx.pending_rows) >= ctx.write_buffer_target:
        flush_pending_rows(ctx, append_ohlcv_part_v5=append_ohlcv_part_v5, job_id=job_id, symbol=symbol)
    ctx.chunks += 1
    set_pull_job(
        job_id,
        phase="fetching",
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
        progressLabel=f"Reading batch {current_batch_index}: current {len(part):,}, total {ctx.rows_fetched_total:,}" + (f" / {ctx.target:,}" if ctx.target else ""),
        detailMessage="Reading M1 data from MT5",
    )
    return len(part) >= want
