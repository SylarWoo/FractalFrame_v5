from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from .store_v5_operations_service import safe_int
from .store_v5_status_service import utc_now_iso


def sync_direct_m1_from_raw_tail(
    *,
    root: Path,
    symbol: str,
    raw_key: str,
    direct_key: str,
    direct_cell: dict[str, Any] | None,
    previous_raw_rows_count: int,
    rows_written_total: int,
    mode: str,
    manifest_total_last_time: Callable[[], int | None],
) -> dict[str, Any] | None:
    if not direct_cell:
        return None

    from python.data_warehouse.store_v5.manifest_v5 import upsert_dataset_cell
    from python.data_warehouse.store_v5.partitioned_parquet_writer_v5 import append_ohlcv_part_v5
    from python.data_warehouse.store_v5.store_v5_paths import dataset_root

    direct_sync: dict[str, Any] | None = None
    try:
        import duckdb

        direct_last_time = safe_int(direct_cell.get("lastTrueM1Time") or direct_cell.get("lastTime"))
        if direct_last_time is not None:
            raw_root = dataset_root(provider="mt5", symbol=symbol, mode="raw_direct", timeframe="M1", store_root=root)
            raw_files = sorted(str(path) for path in raw_root.rglob("part-*.parquet"))
            direct_tail_rows: list[dict[str, Any]] = []
            if raw_files:
                con = duckdb.connect(database=":memory:")
                try:
                    direct_tail_rows = con.execute(
                        "SELECT * FROM read_parquet(?) WHERE time > ? ORDER BY time",
                        [raw_files, int(direct_last_time)],
                    ).fetchdf().to_dict("records")
                finally:
                    con.close()
            if direct_tail_rows:
                tail_times = sorted({int(row["time"]) for row in direct_tail_rows})
                first_tail_time = tail_times[0]
                last_tail_time = tail_times[-1]
                gap_count = int(direct_cell.get("gapCount") or 0)
                first_gap = direct_cell.get("firstGap")
                previous_time = int(direct_last_time)
                for current_time in tail_times:
                    delta = current_time - previous_time
                    if delta > 60:
                        gap_count += 1
                        if not first_gap:
                            first_gap = {
                                "previousTime": previous_time,
                                "nextTime": current_time,
                                "deltaSeconds": delta,
                                "missingBarsEstimate": max(0, delta // 60 - 1),
                            }
                    previous_time = current_time
                previous_true_count = int(direct_cell.get("trueM1RowsCount") or direct_cell.get("rowsCount") or 0)
                sync_now = utc_now_iso()
                write_direct = append_ohlcv_part_v5(
                    direct_tail_rows,
                    provider="mt5",
                    symbol=symbol,
                    mode="direct",
                    timeframe="M1",
                    store_root=root,
                    source="store_v5_raw_direct_incremental_sync",
                    deduplicate_existing_time=True,
                    manifest_extra={
                        **direct_cell,
                        "sourceDataset": raw_key,
                        "sourceRawRowsCount": previous_raw_rows_count + rows_written_total,
                        "sourceRawLastTime": manifest_total_last_time(),
                        "mt5RowsCount": int(direct_cell.get("mt5RowsCount") or previous_true_count) + len(direct_tail_rows),
                        "trueM1RowsCount": previous_true_count + len(tail_times),
                        "lastTrueM1Time": last_tail_time,
                        "lastImportAt": sync_now,
                        "lastImportMode": mode,
                        "lastIncrementalSyncAt": sync_now,
                        "lastIncrementalSyncRows": len(tail_times),
                        "gapCount": gap_count,
                        "firstGap": first_gap,
                        "m1IntegrityStatus": "true_m1_continuous" if gap_count == 0 else "true_m1_with_session_gaps",
                        "status": "ready",
                        "dirty": False,
                        "cleanStatus": "ready",
                        "staleReason": None,
                        "updatedAt": sync_now,
                    },
                )
                direct_sync = {
                    "rowsCandidate": len(direct_tail_rows),
                    "rowsWritten": int(write_direct.get("rowsWritten") or 0),
                    "firstTime": first_tail_time,
                    "lastTime": last_tail_time,
                }
        if direct_sync is None and rows_written_total:
            upsert_dataset_cell(
                root,
                direct_key,
                {
                    **direct_cell,
                    "status": "stale",
                    "dirty": True,
                    "cleanStatus": "stale",
                    "staleReason": "raw_direct_updated",
                    "updatedAt": utc_now_iso(),
                },
            )
    except Exception as sync_exc:
        upsert_dataset_cell(
            root,
            direct_key,
            {
                **direct_cell,
                "status": "stale",
                "dirty": True,
                "cleanStatus": "stale",
                "staleReason": f"direct_incremental_sync_failed:{sync_exc}",
                "updatedAt": utc_now_iso(),
            },
        )
    return direct_sync
