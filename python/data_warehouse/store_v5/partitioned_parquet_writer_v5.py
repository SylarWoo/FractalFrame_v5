from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

import pandas as pd

from .manifest_v5 import load_manifest_v5, save_manifest_v5, utc_now_iso
from .ohlcv_schema_v5 import CANONICAL_COLUMNS, normalize_ohlcv_rows_v5
from .store_v5_paths import (
    SCHEMA_VERSION,
    STORE_VERSION,
    dataset_key,
    dataset_relative_root,
    dataset_root,
    ensure_store_layout,
)


def _partition_dir(root: Path, time_value: int) -> Path:
    dt = pd.to_datetime(int(time_value), unit="s", utc=True)
    return root / f"year={dt.year:04d}" / f"month={dt.month:02d}"


def _existing_times(partition_dir: Path) -> set[int]:
    files = list(partition_dir.glob("part-*.parquet"))
    if not files:
        return set()
    times: set[int] = set()
    for file in files:
        frame = pd.read_parquet(file, columns=["time"])
        times.update(int(v) for v in frame["time"].tolist())
    return times


def _parts_count(root: Path) -> int:
    return len(list(root.rglob("part-*.parquet"))) if root.exists() else 0


def append_ohlcv_part_v5(
    rows,
    *,
    provider: str,
    symbol: str,
    mode: str,
    timeframe: str,
    base_timeframe: str | None = None,
    anchor: str | None = None,
    store_root: str | Path | None = None,
    source: str = "mt5_terminal",
    deduplicate_existing_time: bool = True,
    manifest_extra: dict | None = None,
) -> dict[str, Any]:
    root = ensure_store_layout(store_root)
    key = dataset_key(
        provider=provider,
        symbol=symbol,
        mode=mode,
        timeframe=timeframe,
        base_timeframe=base_timeframe,
        anchor=anchor,
    )
    rel_root = dataset_relative_root(
        provider=provider,
        symbol=symbol,
        mode=mode,
        timeframe=timeframe,
        base_timeframe=base_timeframe,
        anchor=anchor,
    )
    ds_root = dataset_root(
        provider=provider,
        symbol=symbol,
        mode=mode,
        timeframe=timeframe,
        base_timeframe=base_timeframe,
        anchor=anchor,
        store_root=root,
    )
    df = normalize_ohlcv_rows_v5(
        rows,
        provider=provider,
        symbol=symbol,
        timeframe=timeframe,
        source=source,
    )

    rows_written = 0
    duplicate_rows = 0
    written_files: list[str] = []
    if not df.empty:
        for _, partition_df in df.groupby([df["time"].map(lambda v: (pd.to_datetime(int(v), unit="s", utc=True).year, pd.to_datetime(int(v), unit="s", utc=True).month))]):
            partition_dir = _partition_dir(ds_root, int(partition_df["time"].iloc[0]))
            partition_dir.mkdir(parents=True, exist_ok=True)
            if deduplicate_existing_time:
                existing = _existing_times(partition_dir)
                before = len(partition_df)
                partition_df = partition_df[~partition_df["time"].isin(existing)]
                duplicate_rows += before - len(partition_df)
            if partition_df.empty:
                continue
            first_time = int(partition_df["time"].min())
            part_name = f"part-{pd.to_datetime(first_time, unit='s', utc=True).strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}.parquet"
            out = partition_dir / part_name
            partition_df[CANONICAL_COLUMNS].to_parquet(out, index=False)
            rows_written += len(partition_df)
            written_files.append(str(out))

    manifest = load_manifest_v5(root)
    previous = manifest["datasets"].get(key, {})
    previous_rows = int(previous.get("rowsCount") or 0)
    first_time = previous.get("firstTime")
    last_time = previous.get("lastTime")
    if not df.empty and rows_written:
        written_min = int(df["time"].min())
        written_max = int(df["time"].max())
        first_time = written_min if first_time is None else min(int(first_time), written_min)
        last_time = written_max if last_time is None else max(int(last_time), written_max)

    cell = {
        **previous,
        "provider": provider,
        "symbol": symbol,
        "mode": mode,
        "timeframe": timeframe,
        "baseTimeframe": base_timeframe,
        "anchor": anchor,
        "rootPath": rel_root.as_posix(),
        "rowsCount": previous_rows + rows_written,
        "partsCount": _parts_count(ds_root),
        "firstTime": first_time,
        "lastTime": last_time,
        "status": "ready",
        "dirty": False,
        "schemaVersion": SCHEMA_VERSION,
    }
    if manifest_extra:
        cell.update(manifest_extra)
    if mode == "direct":
        cell["rowsCount"] = int(cell.get("trueM1RowsCount") or cell["rowsCount"])
    cell.setdefault("storeVersion", STORE_VERSION)
    manifest["datasets"][key] = cell
    save_manifest_v5(manifest, root)
    return {
        "ok": True,
        "datasetKey": key,
        "rowsWritten": rows_written,
        "duplicateRows": duplicate_rows,
        "partsWritten": len(written_files),
        "writtenFiles": written_files,
        "manifestCell": cell,
    }
