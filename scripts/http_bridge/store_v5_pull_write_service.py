from __future__ import annotations

from typing import Any

from .store_v5_pull_context import StoreV5PullContext
from .store_v5_pull_job_state import set_pull_job, write_progress
from .store_v5_status_service import format_utc_text, utc_now_iso


def flush_pending_rows(
    ctx: StoreV5PullContext,
    *,
    append_ohlcv_part_v5: Any,
    job_id: str,
    progress_floor: float | None = None,
    symbol: str,
) -> None:
    if not ctx.pending_rows:
        return
    batch_rows = len(ctx.pending_rows)
    progress_before = write_progress(ctx.rows_written_total, ctx.chunks, ctx.target)
    if progress_floor is not None:
        progress_before = max(progress_before, progress_floor)
    set_pull_job(
        job_id,
        phase="writing",
        status="store_v5_pull_raw_m1_writing",
        currentAction="append_raw_direct_m1_buffer",
        progressPercent=progress_before,
        rowsFetched=ctx.rows_fetched_total,
        rowsWritten=ctx.rows_written_total,
        rawRowsCount=ctx.rows_written_total,
        duplicateRows=ctx.duplicate_rows_total,
        chunksCompleted=ctx.chunks,
        fetchChunkSize=ctx.step,
        maxCount=ctx.target,
        writeBatchRows=batch_rows,
        writeBatchWritten=0,
        pendingWriteRows=batch_rows,
        firstTimeText=format_utc_text(ctx.first_time),
        lastTimeText=format_utc_text(ctx.last_time),
        cleanStatus="pending",
        progressLabel=f"Writing batch: {batch_rows:,}, total written {ctx.rows_written_total:,}",
        detailMessage="Writing StoreV5 raw_direct/M1 parquet",
    )
    write = append_ohlcv_part_v5(
        ctx.pending_rows,
        provider="mt5",
        symbol=symbol,
        mode="raw_direct",
        timeframe="M1",
        store_root=ctx.root,
        source="mt5_terminal",
        deduplicate_existing_time=(ctx.mode != "refresh"),
        manifest_extra={
            "mt5RowsCount": ctx.previous_raw_mt5_rows_count + ctx.rows_fetched_total if ctx.mode != "refresh" else ctx.rows_fetched_total,
            "rawRowsCount": ctx.previous_raw_rows_count + ctx.rows_written_total + len(ctx.pending_rows) if ctx.mode != "refresh" else ctx.rows_written_total + len(ctx.pending_rows),
            "firstRawM1Time": ctx.manifest_total_first_time(),
            "lastRawM1Time": ctx.manifest_total_last_time(),
            "rawIngestStatus": "raw_m1_written",
            "cleanStatus": "pending",
            "lastImportAt": utc_now_iso(),
            "lastImportMode": ctx.mode,
            "lastPullMethod": "copy_rates_from_pos_buffered_raw_direct",
            "lastPullChunkSize": ctx.step,
            "lastWriteBufferTarget": ctx.write_buffer_target,
            "lastAddedRows": len(ctx.pending_rows),
            "lastDuplicateRows": ctx.duplicate_rows_total,
            "dirty": False,
            "compactRecommended": True,
        },
    )
    batch_written = int(write.get("rowsWritten") or 0)
    ctx.rows_written_total += batch_written
    ctx.duplicate_rows_total += int(write.get("duplicateRows") or 0)
    ctx.pending_rows.clear()
    progress_after = write_progress(ctx.rows_written_total, ctx.chunks, ctx.target)
    if progress_floor is not None:
        progress_after = max(progress_after, progress_floor)
    set_pull_job(
        job_id,
        phase="writing",
        status="store_v5_pull_raw_m1_write_batch_done",
        currentAction="append_raw_direct_m1_buffer_done",
        progressPercent=progress_after,
        rowsFetched=ctx.rows_fetched_total,
        rowsWritten=ctx.rows_written_total,
        rawRowsCount=ctx.rows_written_total,
        duplicateRows=ctx.duplicate_rows_total,
        chunksCompleted=ctx.chunks,
        fetchChunkSize=ctx.step,
        maxCount=ctx.target,
        writeBatchRows=batch_rows,
        writeBatchWritten=batch_written,
        pendingWriteRows=0,
        firstTimeText=format_utc_text(ctx.first_time),
        lastTimeText=format_utc_text(ctx.last_time),
        cleanStatus="pending",
        progressLabel=f"Batch written: {batch_written:,}, total {ctx.rows_written_total:,}",
        detailMessage="Current parquet batch written",
    )
