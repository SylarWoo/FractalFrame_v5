from __future__ import annotations

import threading
import uuid
from pathlib import Path
from typing import Any

from .jobs import PULL_JOB_TERMINAL_PHASES
from .store_v5_pull_context import build_pull_context
from .store_v5_pull_fetch_service import fetch_store_v5_raw_m1
from .store_v5_pull_finalize_service import finalize_store_v5_pull_job
from .store_v5_pull_job_state import PULL_JOB_STORE, public_pull_job_snapshot, get_pull_job, set_pull_job
from .store_v5_pull_write_service import flush_pending_rows
from .store_v5_status_service import format_utc_text, utc_now_iso


def run_store_v5_pull_job(job_id: str, symbol: str, *, mode: str, count: int | None, store_root: Path | None, fetch_chunk: int = 500_000) -> None:
    from python.data_warehouse.store_v5.manifest_v5 import delete_dataset_cell, get_dataset_cell, mark_aggregated_dirty_for_symbol
    from python.data_warehouse.store_v5.ohlcv_schema_v5 import mt5_row_to_canonical
    from python.data_warehouse.store_v5.partitioned_parquet_writer_v5 import append_ohlcv_part_v5
    from python.data_warehouse.store_v5.store_v5_paths import STORE_VERSION, dataset_key, dataset_root, manifest_path, resolve_store_root

    initialized = False
    try:
        import MetaTrader5 as mt5

        if not mt5.initialize():
            set_pull_job(
                job_id,
                ok=False,
                phase="failed",
                status="mt5_initialize_failed",
                mt5LastError=mt5.last_error(),
                progressPercent=None,
                progressLabel="Failed: MT5 initialize failed",
                detailMessage="Unable to initialize MT5 before pull starts",
                finishedAt=utc_now_iso(),
            )
            return
        initialized = True
        if not mt5.symbol_select(symbol, True):
            set_pull_job(
                job_id,
                ok=False,
                phase="failed",
                status="mt5_symbol_select_failed",
                mt5LastError=mt5.last_error(),
                progressPercent=None,
                progressLabel=f"Failed: unable to select symbol {symbol}",
                detailMessage="MT5 symbol_select failed",
                finishedAt=utc_now_iso(),
            )
            return

        ctx = build_pull_context(
            count=count,
            dataset_key=dataset_key,
            dataset_root=dataset_root,
            delete_dataset_cell=delete_dataset_cell,
            fetch_chunk=fetch_chunk,
            get_dataset_cell=get_dataset_cell,
            mode=mode,
            resolve_store_root=resolve_store_root,
            store_root=store_root,
            symbol=symbol,
        )
        raw_key = ctx.raw_key
        direct_key = ctx.direct_key

        set_pull_job(
            job_id,
            phase="fetching",
            status="store_v5_pull_raw_m1_fetching",
            currentAction="copy_rates_from_pos",
            progressPercent=1,
            rowsFetched=0,
            rowsWritten=0,
            rawRowsCount=0,
            duplicateRows=0,
            chunksCompleted=0,
            fetchChunkSize=ctx.step,
            maxCount=ctx.target,
            currentBatchIndex=0,
            currentBatchRequested=0,
            currentBatchFetched=0,
            writeBatchRows=0,
            writeBatchWritten=0,
            pendingWriteRows=0,
            progressLabel=f"Start reading MT5 M1, batch size {ctx.step:,} rows",
            detailMessage="Reading M1 data from MT5",
        )
        if not fetch_store_v5_raw_m1(
            ctx,
            append_ohlcv_part_v5=append_ohlcv_part_v5,
            job_id=job_id,
            mt5=mt5,
            mt5_row_to_canonical=mt5_row_to_canonical,
            symbol=symbol,
        ):
            return
        set_pull_job(
            job_id,
            phase="writing",
            status="store_v5_pull_raw_m1_final_writing",
            currentAction="append_raw_direct_m1_final_buffer",
            progressPercent=96,
            rowsFetched=ctx.rows_fetched_total,
            rowsWritten=ctx.rows_written_total,
            rawRowsCount=ctx.rows_written_total,
            duplicateRows=ctx.duplicate_rows_total,
            chunksCompleted=ctx.chunks,
            fetchChunkSize=ctx.step,
            maxCount=ctx.target,
            writeBatchRows=len(ctx.pending_rows),
            writeBatchWritten=0,
            pendingWriteRows=len(ctx.pending_rows),
            firstTimeText=format_utc_text(ctx.first_time),
            lastTimeText=format_utc_text(ctx.last_time),
            cleanStatus="pending",
            progressLabel=f"Writing final batch: {len(ctx.pending_rows):,}",
            detailMessage="Writing final StoreV5 parquet batch",
        )
        flush_pending_rows(ctx, append_ohlcv_part_v5=append_ohlcv_part_v5, job_id=job_id, progress_floor=96, symbol=symbol)

        set_pull_job(
            job_id,
            phase="finalizing",
            status="store_v5_pull_manifest_finalizing",
            currentAction="finalize_manifest",
            progressPercent=98,
            rowsFetched=ctx.rows_fetched_total,
            rowsWritten=ctx.rows_written_total,
            rawRowsCount=ctx.rows_written_total,
            duplicateRows=ctx.duplicate_rows_total,
            chunksCompleted=ctx.chunks,
            fetchChunkSize=ctx.step,
            maxCount=ctx.target,
            writeBatchRows=0,
            writeBatchWritten=0,
            pendingWriteRows=0,
            firstTimeText=format_utc_text(ctx.first_time),
            lastTimeText=format_utc_text(ctx.last_time),
            cleanStatus="pending",
            progressLabel="Updating manifest and aggregate dirty state",
            detailMessage="Refreshing StoreV5 manifest",
        )

        finalize_store_v5_pull_job(
            ctx,
            direct_key=direct_key,
            get_dataset_cell=get_dataset_cell,
            job_id=job_id,
            manifest_path=manifest_path,
            mark_aggregated_dirty_for_symbol=mark_aggregated_dirty_for_symbol,
            raw_key=raw_key,
            store_version=STORE_VERSION,
            symbol=symbol,
        )

    except Exception as exc:
        ctx = locals().get("ctx")
        rows_fetched = int(getattr(ctx, "rows_fetched_total", 0) or 0)
        rows_written = int(getattr(ctx, "rows_written_total", 0) or 0)
        duplicate_rows = int(getattr(ctx, "duplicate_rows_total", 0) or 0)
        set_pull_job(
            job_id,
            ok=False,
            phase="failed",
            status="store_v5_pull_exception",
            error=str(exc),
            progressPercent=None,
            rowsFetched=rows_fetched,
            rowsWritten=rows_written,
            rawRowsCount=rows_written,
            duplicateRows=duplicate_rows,
            progressLabel=f"Failed: {exc}",
            detailMessage="Error during pull or write",
            finishedAt=utc_now_iso(),
        )
    finally:
        if initialized:
            try:
                mt5.shutdown()
            except Exception:
                pass


def start_store_v5_pull_job(symbol: str, *, mode: str, count: int | None, store_root: Path | None = None) -> dict[str, Any]:
    job_id = uuid.uuid4().hex
    now = utc_now_iso()
    PULL_JOB_STORE.prune_terminal(PULL_JOB_TERMINAL_PHASES)
    job = {
        "ok": True,
        "jobId": job_id,
        "symbol": symbol,
        "mode": mode,
        "phase": "queued",
        "status": "store_v5_pull_queued",
        "currentAction": "waiting_to_start",
        "progressPercent": 0,
        "rowsFetched": 0,
        "rowsWritten": 0,
        "rawRowsCount": 0,
        "duplicateRows": 0,
        "chunksCompleted": 0,
        "fetchChunkSize": 500_000,
        "maxCount": count,
        "currentBatchIndex": 0,
        "currentBatchRequested": 0,
        "currentBatchFetched": 0,
        "writeBatchRows": 0,
        "writeBatchWritten": 0,
        "pendingWriteRows": 0,
        "progressLabel": "Preparing MT5 M1 pull",
        "detailMessage": "Waiting for StoreV5 pull job to start",
        "createdAt": now,
        "updatedAt": now,
        "lastEventId": 1,
        "events": [],
    }
    snapshot = public_pull_job_snapshot(job)
    job["events"].append({"id": 1, "event": "progress", "data": snapshot})
    PULL_JOB_STORE.create(job_id, job)
    thread = threading.Thread(
        target=run_store_v5_pull_job,
        args=(job_id, symbol),
        kwargs={"mode": mode, "count": count, "store_root": store_root},
        daemon=True,
    )
    thread.start()
    return get_pull_job(job_id) or {"ok": False, "error": "job_not_found", "jobId": job_id}




