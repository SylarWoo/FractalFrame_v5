from __future__ import annotations

from typing import Any

from .store_v5_direct_sync_service import sync_direct_m1_from_raw_tail
from .store_v5_pull_context import StoreV5PullContext
from .store_v5_pull_job_state import set_pull_job
from .store_v5_status_service import format_utc_text, utc_now_iso


def finalize_store_v5_pull_job(
    ctx: StoreV5PullContext,
    *,
    direct_key: str,
    get_dataset_cell: Any,
    job_id: str,
    manifest_path: Any,
    mark_aggregated_dirty_for_symbol: Any,
    raw_key: str,
    store_version: str,
    symbol: str,
) -> None:
    direct_cell = get_dataset_cell(ctx.root, direct_key)
    direct_sync = sync_direct_m1_from_raw_tail(
        root=ctx.root,
        symbol=symbol,
        raw_key=raw_key,
        direct_key=direct_key,
        direct_cell=direct_cell,
        previous_raw_rows_count=ctx.previous_raw_rows_count,
        rows_written_total=ctx.rows_written_total,
        mode=ctx.mode,
        manifest_total_last_time=ctx.manifest_total_last_time,
    )
    mark_aggregated_dirty_for_symbol(ctx.root, provider="mt5", symbol=symbol)
    report = {
        "ok": True,
        "status": "mt5_m1_raw_refresh_completed" if ctx.mode == "refresh" else "mt5_m1_raw_incremental_completed",
        "symbol": symbol,
        "storeVersion": store_version,
        "importMode": ctx.mode,
        "datasetMode": "raw_direct",
        "mt5RowsCount": ctx.rows_fetched_total,
        "rawRowsCount": ctx.rows_written_total,
        "rowsWritten": ctx.rows_written_total,
        "duplicateRows": ctx.duplicate_rows_total,
        "firstRawM1Time": ctx.first_time,
        "lastRawM1Time": ctx.last_time,
        "cleanStatus": "pending",
        "directSync": direct_sync,
        "manifestPath": str(manifest_path(ctx.root)),
    }
    set_pull_job(
        job_id,
        ok=True,
        phase="completed",
        status=report["status"],
        progressPercent=100,
        rowsFetched=ctx.rows_fetched_total,
        rowsWritten=ctx.rows_written_total,
        rawRowsCount=ctx.rows_written_total,
        duplicateRows=ctx.duplicate_rows_total,
        cleanStatus="pending",
        firstTimeText=format_utc_text(ctx.first_time),
        lastTimeText=format_utc_text(ctx.last_time),
        progressLabel=f"Completed: read {ctx.rows_fetched_total:,}, wrote {ctx.rows_written_total:,}, duplicates {ctx.duplicate_rows_total:,}",
        detailMessage="Local M1 raw_direct updated",
        result=report,
        finishedAt=utc_now_iso(),
    )
