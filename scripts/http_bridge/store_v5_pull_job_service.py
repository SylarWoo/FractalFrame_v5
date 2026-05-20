from __future__ import annotations

import shutil
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .jobs import PULL_JOBS, PULL_JOBS_CONDITION
from .store_v5_direct_sync_service import sync_direct_m1_from_raw_tail
from .mt5_m1_check_service import mt5_rates_to_rows
from .store_v5_direct_cleanup_service import cleanup_direct_m1_prefix_before_time_v5
from .store_v5_operations_service import safe_int
from .store_v5_pull_job_state import get_pull_job, read_progress, set_pull_job, write_progress
from .store_v5_status_service import format_utc_text, utc_now_iso


def run_store_v5_pull_job(job_id: str, symbol: str, *, mode: str, count: int | None, store_root: Path | None, fetch_chunk: int = 500_000) -> None:
    from python.data_warehouse.mt5.mt5_m1_integrity_validator_v1 import validate_true_m1_rows_v1
    from python.data_warehouse.store_v5.manifest_v5 import delete_dataset_cell, get_dataset_cell, mark_aggregated_dirty_for_symbol
    from python.data_warehouse.store_v5.ohlcv_schema_v5 import mt5_row_to_canonical
    from python.data_warehouse.store_v5.partitioned_parquet_writer_v5 import append_ohlcv_part_v5
    from python.data_warehouse.store_v5.store_v5_paths import STORE_VERSION, dataset_key, dataset_root, manifest_path, resolve_store_root

    root = resolve_store_root(store_root)
    raw_key = dataset_key(provider="mt5", symbol=symbol, mode="raw_direct", timeframe="M1")
    direct_key = dataset_key(provider="mt5", symbol=symbol, mode="direct", timeframe="M1")
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

        step = max(1, int(fetch_chunk))
        target = int(count) if count is not None and int(count) > 0 else None

        previous_first_time = None
        previous_last_time = None
        previous_raw_rows_count = 0
        previous_raw_mt5_rows_count = 0
        range_window: dict[str, Any] | None = None
        if mode == "refresh":
            raw_root = dataset_root(provider="mt5", symbol=symbol, mode="raw_direct", timeframe="M1", store_root=root)
            if raw_root.exists():
                shutil.rmtree(raw_root)
            delete_dataset_cell(root, raw_key)
            pos = 0
        else:
            raw_cell = get_dataset_cell(root, raw_key)
            if not raw_cell or raw_cell.get("lastTime") is None:
                mode = "refresh"
                raw_root = dataset_root(provider="mt5", symbol=symbol, mode="raw_direct", timeframe="M1", store_root=root)
                if raw_root.exists():
                    shutil.rmtree(raw_root)
                delete_dataset_cell(root, raw_key)
                pos = 0
            else:
                previous_first_time = safe_int(raw_cell.get("firstTime") or raw_cell.get("firstRawM1Time"))
                previous_last_time = safe_int(raw_cell.get("lastTime") or raw_cell.get("lastRawM1Time"))
                previous_raw_rows_count = int(raw_cell.get("rowsCount") or raw_cell.get("rawRowsCount") or 0)
                previous_raw_mt5_rows_count = int(raw_cell.get("rowsCount") or raw_cell.get("mt5RowsCount") or previous_raw_rows_count)
                if previous_last_time is None:
                    mode = "refresh"
                    raw_root = dataset_root(provider="mt5", symbol=symbol, mode="raw_direct", timeframe="M1", store_root=root)
                    if raw_root.exists():
                        shutil.rmtree(raw_root)
                    delete_dataset_cell(root, raw_key)
                else:
                    overlap_bars = 1000
                    from_time = max(0, int(previous_last_time) - overlap_bars * 60)
                    range_window = {
                        "fromTime": from_time,
                        "toTime": int(datetime.now(timezone.utc).timestamp()),
                        "overlapBars": overlap_bars,
                        "previousFirstTime": previous_first_time,
                        "previousLastTime": previous_last_time,
                    }
                pos = 0

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
            fetchChunkSize=step,
            maxCount=target,
            currentBatchIndex=0,
            currentBatchRequested=0,
            currentBatchFetched=0,
            writeBatchRows=0,
            writeBatchWritten=0,
            pendingWriteRows=0,
            progressLabel=f"Start reading MT5 M1, batch size {step:,} rows",
            detailMessage="Reading M1 data from MT5",
        )

        seen_times: set[int] = set()
        write_buffer_target = 500_000
        pending_rows: list[dict[str, Any]] = []
        rows_fetched_total = 0
        rows_written_total = 0
        duplicate_rows_total = 0
        chunks = 0
        first_time = None
        last_time = None

        def keep_incremental_row(row_time: int) -> bool:
            if mode == "refresh" or previous_first_time is None or previous_last_time is None:
                return True
            return row_time < int(previous_first_time) or row_time > int(previous_last_time)

        def manifest_total_first_time() -> int | None:
            if previous_first_time is None:
                return first_time
            if first_time is None:
                return previous_first_time
            return min(int(previous_first_time), int(first_time))

        def manifest_total_last_time() -> int | None:
            if previous_last_time is None:
                return last_time
            if last_time is None:
                return previous_last_time
            return max(int(previous_last_time), int(last_time))

        def flush_pending_rows(progress_floor: float | None = None) -> None:
            nonlocal rows_written_total, duplicate_rows_total
            if not pending_rows:
                return
            batch_rows = len(pending_rows)
            progress_before = write_progress(rows_written_total, chunks, target)
            if progress_floor is not None:
                progress_before = max(progress_before, progress_floor)
            set_pull_job(
                job_id,
                phase="writing",
                status="store_v5_pull_raw_m1_writing",
                currentAction="append_raw_direct_m1_buffer",
                progressPercent=progress_before,
                rowsFetched=rows_fetched_total,
                rowsWritten=rows_written_total,
                rawRowsCount=rows_written_total,
                duplicateRows=duplicate_rows_total,
                chunksCompleted=chunks,
                fetchChunkSize=step,
                maxCount=target,
                writeBatchRows=batch_rows,
                writeBatchWritten=0,
                pendingWriteRows=batch_rows,
                firstTimeText=format_utc_text(first_time),
                lastTimeText=format_utc_text(last_time),
                cleanStatus="pending",
                progressLabel=f"Writing batch: {batch_rows:,}, total written {rows_written_total:,}",
                detailMessage="Writing StoreV5 raw_direct/M1 parquet",
            )
            write = append_ohlcv_part_v5(
                pending_rows,
                provider="mt5",
                symbol=symbol,
                mode="raw_direct",
                timeframe="M1",
                store_root=root,
                source="mt5_terminal",
                deduplicate_existing_time=(mode != "refresh"),
                manifest_extra={
                    "mt5RowsCount": previous_raw_mt5_rows_count + rows_fetched_total if mode != "refresh" else rows_fetched_total,
                    "rawRowsCount": previous_raw_rows_count + rows_written_total + len(pending_rows) if mode != "refresh" else rows_written_total + len(pending_rows),
                    "firstRawM1Time": manifest_total_first_time(),
                    "lastRawM1Time": manifest_total_last_time(),
                    "rawIngestStatus": "raw_m1_written",
                    "cleanStatus": "pending",
                    "lastImportAt": utc_now_iso(),
                    "lastImportMode": mode,
                    "lastPullMethod": "copy_rates_from_pos_buffered_raw_direct",
                    "lastPullChunkSize": step,
                    "lastWriteBufferTarget": write_buffer_target,
                    "lastAddedRows": len(pending_rows),
                    "lastDuplicateRows": duplicate_rows_total,
                    "dirty": False,
                    "compactRecommended": True,
                },
            )
            batch_written = int(write.get("rowsWritten") or 0)
            rows_written_total += int(write.get("rowsWritten") or 0)
            duplicate_rows_total += int(write.get("duplicateRows") or 0)
            pending_rows.clear()
            progress_after = write_progress(rows_written_total, chunks, target)
            if progress_floor is not None:
                progress_after = max(progress_after, progress_floor)
            set_pull_job(
                job_id,
                phase="writing",
                status="store_v5_pull_raw_m1_write_batch_done",
                currentAction="append_raw_direct_m1_buffer_done",
                progressPercent=progress_after,
                rowsFetched=rows_fetched_total,
                rowsWritten=rows_written_total,
                rawRowsCount=rows_written_total,
                duplicateRows=duplicate_rows_total,
                chunksCompleted=chunks,
                fetchChunkSize=step,
                maxCount=target,
                writeBatchRows=batch_rows,
                writeBatchWritten=batch_written,
                pendingWriteRows=0,
                firstTimeText=format_utc_text(first_time),
                lastTimeText=format_utc_text(last_time),
                cleanStatus="pending",
                progressLabel=f"Batch written: {batch_written:,}, total {rows_written_total:,}",
                detailMessage="Current parquet batch written",
            )

        if range_window is not None:
            job = get_pull_job(job_id)
            if job and job.get("cancelRequested"):
                set_pull_job(
                    job_id,
                    ok=False,
                    phase="cancelled",
                    status="store_v5_pull_cancelled",
                    rowsFetched=0,
                    rowsWritten=0,
                    rawRowsCount=0,
                    duplicateRows=0,
                    progressLabel="Cancelled",
                    detailMessage="User cancelled StoreV5 pull job",
                    finishedAt=utc_now_iso(),
                )
                return

            from_time = int(range_window["fromTime"])
            to_time = int(range_window["toTime"])
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
                fetchChunkSize=step,
                maxCount=target,
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
            rows_fetched_total = len(part)
            chunks = 1 if part else 0
            new_part = []
            for row in part:
                row_time = int(row.get("time") or 0)
                if row_time <= 0 or row_time in seen_times:
                    duplicate_rows_total += 1
                    continue
                seen_times.add(row_time)
                if not keep_incremental_row(row_time):
                    duplicate_rows_total += 1
                    continue
                new_part.append(row)

            if new_part:
                canonical_batch = [mt5_row_to_canonical(row, provider="mt5", symbol=symbol, timeframe="M1") for row in new_part]
                batch_first = min((int(row["time"]) for row in canonical_batch), default=None)
                batch_last = max((int(row["time"]) for row in canonical_batch), default=None)
                first_time = batch_first if first_time is None else min(first_time, batch_first or first_time)
                last_time = batch_last if last_time is None else max(last_time, batch_last or last_time)
                pending_rows.extend(canonical_batch)

            set_pull_job(
                job_id,
                phase="fetching",
                status="store_v5_pull_raw_m1_incremental_fetched",
                currentAction="copy_rates_range_done",
                progressPercent=65,
                rowsFetched=rows_fetched_total,
                rowsWritten=rows_written_total,
                rawRowsCount=rows_written_total,
                duplicateRows=duplicate_rows_total,
                chunksCompleted=chunks,
                fetchChunkSize=step,
                maxCount=target,
                currentBatchIndex=1,
                currentBatchRequested=0,
                currentBatchFetched=len(part),
                writeBatchRows=len(new_part),
                writeBatchWritten=0,
                pendingWriteRows=len(pending_rows),
                firstTimeText=format_utc_text(first_time),
                lastTimeText=format_utc_text(last_time),
                cleanStatus="pending",
                progressLabel=f"Incremental read done: MT5 returned {len(part):,}, new candidates {len(new_part):,}, skipped {duplicate_rows_total:,}",
                detailMessage="Filtered existing M1 using lastTime overlap",
            )

        while range_window is None and (target is None or pos < target):
            job = get_pull_job(job_id)
            if job and job.get("cancelRequested"):
                set_pull_job(
                    job_id,
                    ok=False,
                    phase="cancelled",
                    status="store_v5_pull_cancelled",
                    rowsFetched=rows_fetched_total,
                    rowsWritten=rows_written_total,
                    rawRowsCount=rows_written_total,
                    duplicateRows=duplicate_rows_total,
                    progressLabel="Cancelled",
                    detailMessage="User cancelled StoreV5 pull job",
                    finishedAt=utc_now_iso(),
                )
                return

            want = step if target is None else min(step, target - pos)
            current_batch_index = chunks + 1
            set_pull_job(
                job_id,
                phase="fetching",
                status="store_v5_pull_raw_m1_requesting",
                currentAction="copy_rates_from_pos",
                progressPercent=read_progress(rows_fetched_total, chunks, target),
                rowsFetched=rows_fetched_total,
                rowsWritten=rows_written_total,
                rawRowsCount=rows_written_total,
                duplicateRows=duplicate_rows_total,
                chunksCompleted=chunks,
                fetchChunkSize=step,
                maxCount=target,
                currentBatchIndex=current_batch_index,
                currentBatchRequested=want,
                currentBatchFetched=0,
                writeBatchRows=0,
                writeBatchWritten=0,
                pendingWriteRows=len(pending_rows),
                firstTimeText=format_utc_text(first_time),
                lastTimeText=format_utc_text(last_time),
                cleanStatus="pending",
                progressLabel=(
                    f"Requesting batch {current_batch_index}: planned {want:,}, "
                    f"total read {rows_fetched_total:,}" + (f" / {target:,}" if target else "")
                ),
                detailMessage="Waiting for MT5 M1 response",
            )
            part = mt5_rates_to_rows(mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, pos, want))
            if not part:
                break
            pos += len(part)
            rows_fetched_total += len(part)
            current_batch_fetched = len(part)

            new_part: list[dict[str, Any]] = []
            for row in part:
                row_time = int(row.get("time") or 0)
                if row_time <= 0 or row_time in seen_times:
                    duplicate_rows_total += 1
                    continue
                seen_times.add(row_time)
                if not keep_incremental_row(row_time):
                    duplicate_rows_total += 1
                    continue
                new_part.append(row)

            if new_part:
                canonical_batch = [mt5_row_to_canonical(row, provider="mt5", symbol=symbol, timeframe="M1") for row in new_part]
                batch_first = min((int(row["time"]) for row in canonical_batch), default=None)
                batch_last = max((int(row["time"]) for row in canonical_batch), default=None)
                first_time = batch_first if first_time is None else min(first_time, batch_first or first_time)
                last_time = batch_last if last_time is None else max(last_time, batch_last or last_time)
                pending_rows.extend(canonical_batch)
                if len(pending_rows) >= write_buffer_target:
                    set_pull_job(
                        job_id,
                        phase="writing",
                        status="store_v5_pull_raw_m1_writing",
                        currentAction="append_raw_direct_m1_buffer",
                        progressPercent=write_progress(rows_written_total, chunks, target),
                        rowsFetched=rows_fetched_total,
                        rowsWritten=rows_written_total,
                        rawRowsCount=rows_written_total,
                        duplicateRows=duplicate_rows_total,
                        chunksCompleted=chunks,
                        fetchChunkSize=step,
                        maxCount=target,
                        writeBatchRows=len(pending_rows),
                        writeBatchWritten=0,
                        pendingWriteRows=len(pending_rows),
                        firstTimeText=format_utc_text(first_time),
                        lastTimeText=format_utc_text(last_time),
                        cleanStatus="pending",
                        progressLabel=f"Writing batch: {len(pending_rows):,}, total written {rows_written_total:,}",
                        detailMessage="Writing StoreV5 raw_direct/M1 parquet",
                    )
                    flush_pending_rows()

            chunks += 1
            set_pull_job(
                job_id,
                phase="fetching",
                status="store_v5_pull_raw_m1_streaming",
                currentAction="copy_rates_from_pos_buffer_raw_direct_m1",
                progressPercent=read_progress(rows_fetched_total, chunks, target),
                rowsFetched=rows_fetched_total,
                rowsWritten=rows_written_total,
                rawRowsCount=rows_written_total,
                duplicateRows=duplicate_rows_total,
                chunksCompleted=chunks,
                fetchChunkSize=step,
                maxCount=target,
                currentBatchIndex=current_batch_index,
                currentBatchRequested=want,
                currentBatchFetched=current_batch_fetched,
                writeBatchRows=len(new_part),
                writeBatchWritten=rows_written_total,
                pendingWriteRows=len(pending_rows),
                firstTimeText=format_utc_text(first_time),
                lastTimeText=format_utc_text(last_time),
                cleanStatus="pending",
                progressLabel=(
                    f"Reading batch {current_batch_index}: current {current_batch_fetched:,}, "
                    f"total {rows_fetched_total:,}" + (f" / {target:,}" if target else "")
                ),
                detailMessage="Reading M1 data from MT5",
            )
            if len(part) < want:
                break

        set_pull_job(
            job_id,
            phase="writing",
            status="store_v5_pull_raw_m1_final_writing",
            currentAction="append_raw_direct_m1_final_buffer",
            progressPercent=96,
            rowsFetched=rows_fetched_total,
            rowsWritten=rows_written_total,
            rawRowsCount=rows_written_total,
            duplicateRows=duplicate_rows_total,
            chunksCompleted=chunks,
            fetchChunkSize=step,
            maxCount=target,
            writeBatchRows=len(pending_rows),
            writeBatchWritten=0,
            pendingWriteRows=len(pending_rows),
            firstTimeText=format_utc_text(first_time),
            lastTimeText=format_utc_text(last_time),
            cleanStatus="pending",
            progressLabel=f"Writing final batch: {len(pending_rows):,}",
            detailMessage="Writing final StoreV5 parquet batch",
        )
        flush_pending_rows(progress_floor=96)

        set_pull_job(
            job_id,
            phase="finalizing",
            status="store_v5_pull_manifest_finalizing",
            currentAction="finalize_manifest",
            progressPercent=98,
            rowsFetched=rows_fetched_total,
            rowsWritten=rows_written_total,
            rawRowsCount=rows_written_total,
            duplicateRows=duplicate_rows_total,
            chunksCompleted=chunks,
            fetchChunkSize=step,
            maxCount=target,
            writeBatchRows=0,
            writeBatchWritten=0,
            pendingWriteRows=0,
            firstTimeText=format_utc_text(first_time),
            lastTimeText=format_utc_text(last_time),
            cleanStatus="pending",
            progressLabel="Updating manifest and aggregate dirty state",
            detailMessage="Refreshing StoreV5 manifest",
        )

        direct_cell = get_dataset_cell(root, direct_key)
        direct_sync = sync_direct_m1_from_raw_tail(
            root=root,
            symbol=symbol,
            raw_key=raw_key,
            direct_key=direct_key,
            direct_cell=direct_cell,
            previous_raw_rows_count=previous_raw_rows_count,
            rows_written_total=rows_written_total,
            mode=mode,
            manifest_total_last_time=manifest_total_last_time,
        )
        mark_aggregated_dirty_for_symbol(root, provider="mt5", symbol=symbol)
        report = {
            "ok": True,
            "status": "mt5_m1_raw_refresh_completed" if mode == "refresh" else "mt5_m1_raw_incremental_completed",
            "symbol": symbol,
            "storeVersion": STORE_VERSION,
            "importMode": mode,
            "datasetMode": "raw_direct",
            "mt5RowsCount": rows_fetched_total,
            "rawRowsCount": rows_written_total,
            "rowsWritten": rows_written_total,
            "duplicateRows": duplicate_rows_total,
            "firstRawM1Time": first_time,
            "lastRawM1Time": last_time,
            "cleanStatus": "pending",
            "directSync": direct_sync,
            "manifestPath": str(manifest_path(root)),
        }
        set_pull_job(
            job_id,
            ok=True,
            phase="completed",
            status=report["status"],
            progressPercent=100,
            rowsFetched=rows_fetched_total,
            rowsWritten=rows_written_total,
            rawRowsCount=rows_written_total,
            duplicateRows=duplicate_rows_total,
            cleanStatus="pending",
            firstTimeText=format_utc_text(first_time),
            lastTimeText=format_utc_text(last_time),
            progressLabel=f"Completed: read {rows_fetched_total:,}, wrote {rows_written_total:,}, duplicates {duplicate_rows_total:,}",
            detailMessage="Local M1 raw_direct updated",
            result=report,
            finishedAt=utc_now_iso(),
        )
    except Exception as exc:
        local_vars = locals()
        set_pull_job(
            job_id,
            ok=False,
            phase="failed",
            status="store_v5_pull_exception",
            error=str(exc),
            progressPercent=None,
            rowsFetched=int(local_vars.get("rows_fetched_total") or 0),
            rowsWritten=int(local_vars.get("rows_written_total") or 0),
            rawRowsCount=int(local_vars.get("rows_written_total") or 0),
            duplicateRows=int(local_vars.get("duplicate_rows_total") or 0),
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
    with PULL_JOBS_CONDITION:
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
        snapshot = _public_pull_job_snapshot(job)
        job["events"].append({"id": 1, "event": "progress", "data": snapshot})
        PULL_JOBS[job_id] = job
        PULL_JOBS_CONDITION.notify_all()
    thread = threading.Thread(
        target=run_store_v5_pull_job,
        args=(job_id, symbol),
        kwargs={"mode": mode, "count": count, "store_root": store_root},
        daemon=True,
    )
    thread.start()
    return get_pull_job(job_id) or {"ok": False, "error": "job_not_found", "jobId": job_id}




