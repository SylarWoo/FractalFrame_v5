from __future__ import annotations

import shutil
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .store_v5_operations_service import safe_int


@dataclass
class StoreV5PullContext:
    root: Path
    raw_key: str
    direct_key: str
    mode: str
    step: int
    target: int | None
    pos: int
    previous_first_time: int | None = None
    previous_last_time: int | None = None
    previous_raw_rows_count: int = 0
    previous_raw_mt5_rows_count: int = 0
    range_window: dict[str, Any] | None = None
    seen_times: set[int] = field(default_factory=set)
    write_buffer_target: int = 500_000
    pending_rows: list[dict[str, Any]] = field(default_factory=list)
    rows_fetched_total: int = 0
    rows_written_total: int = 0
    duplicate_rows_total: int = 0
    chunks: int = 0
    first_time: int | None = None
    last_time: int | None = None

    def keep_incremental_row(self, row_time: int) -> bool:
        if self.mode == "refresh" or self.previous_first_time is None or self.previous_last_time is None:
            return True
        return row_time < int(self.previous_first_time) or row_time > int(self.previous_last_time)

    def manifest_total_first_time(self) -> int | None:
        if self.previous_first_time is None:
            return self.first_time
        if self.first_time is None:
            return self.previous_first_time
        return min(int(self.previous_first_time), int(self.first_time))

    def manifest_total_last_time(self) -> int | None:
        if self.previous_last_time is None:
            return self.last_time
        if self.last_time is None:
            return self.previous_last_time
        return max(int(self.previous_last_time), int(self.last_time))

    def add_canonical_batch(self, canonical_batch: list[dict[str, Any]]) -> None:
        batch_first = min((int(row["time"]) for row in canonical_batch), default=None)
        batch_last = max((int(row["time"]) for row in canonical_batch), default=None)
        self.first_time = batch_first if self.first_time is None else min(self.first_time, batch_first or self.first_time)
        self.last_time = batch_last if self.last_time is None else max(self.last_time, batch_last or self.last_time)
        self.pending_rows.extend(canonical_batch)


def build_pull_context(
    *,
    count: int | None,
    dataset_key: Any,
    dataset_root: Any,
    delete_dataset_cell: Any,
    fetch_chunk: int,
    get_dataset_cell: Any,
    mode: str,
    resolve_store_root: Any,
    store_root: Path | None,
    symbol: str,
) -> StoreV5PullContext:
    root = resolve_store_root(store_root)
    raw_key = dataset_key(provider="mt5", symbol=symbol, mode="raw_direct", timeframe="M1")
    direct_key = dataset_key(provider="mt5", symbol=symbol, mode="direct", timeframe="M1")
    step = max(1, int(fetch_chunk))
    target = int(count) if count is not None and int(count) > 0 else None
    ctx = StoreV5PullContext(root=root, raw_key=raw_key, direct_key=direct_key, mode=mode, step=step, target=target, pos=0)

    def clear_raw() -> None:
        raw_root = dataset_root(provider="mt5", symbol=symbol, mode="raw_direct", timeframe="M1", store_root=root)
        if raw_root.exists():
            shutil.rmtree(raw_root)
        delete_dataset_cell(root, raw_key)

    if mode == "refresh":
        clear_raw()
        return ctx

    raw_cell = get_dataset_cell(root, raw_key)
    if not raw_cell or raw_cell.get("lastTime") is None:
        ctx.mode = "refresh"
        clear_raw()
        return ctx

    ctx.previous_first_time = safe_int(raw_cell.get("firstTime") or raw_cell.get("firstRawM1Time"))
    ctx.previous_last_time = safe_int(raw_cell.get("lastTime") or raw_cell.get("lastRawM1Time"))
    ctx.previous_raw_rows_count = int(raw_cell.get("rowsCount") or raw_cell.get("rawRowsCount") or 0)
    ctx.previous_raw_mt5_rows_count = int(raw_cell.get("rowsCount") or raw_cell.get("mt5RowsCount") or ctx.previous_raw_rows_count)
    if ctx.previous_last_time is None:
        ctx.mode = "refresh"
        clear_raw()
        return ctx

    overlap_bars = 1000
    from_time = max(0, int(ctx.previous_last_time) - overlap_bars * 60)
    ctx.range_window = {
        "fromTime": from_time,
        "toTime": int(datetime.now(timezone.utc).timestamp()),
        "overlapBars": overlap_bars,
        "previousFirstTime": ctx.previous_first_time,
        "previousLastTime": ctx.previous_last_time,
    }
    return ctx
