from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

import pandas as pd

from .manifest_v6 import load_manifest_v6, save_manifest_v6, utc_now_iso
from .paths_v6 import SCHEMA_VERSION, STORE_VERSION, dataset_key, dataset_relative_root, dataset_root, ensure_store_layout
from .schema_v6 import AGGREGATED_COLUMNS, CLEAN_COLUMNS, RAW_COLUMNS, normalize_raw_rows


def _partition_dir(root: Path, open_time: int) -> Path:
    dt = pd.to_datetime(int(open_time), unit="s", utc=True)
    return root / f"year={dt.year:04d}" / f"month={dt.month:02d}"


def _existing_keys(partition_dir: Path) -> set[str]:
    files = list(partition_dir.glob("part-*.parquet"))
    if not files:
        return set()
    keys: set[str] = set()
    for file in files:
        frame = pd.read_parquet(file, columns=["barKey"])
        keys.update(str(v) for v in frame["barKey"].tolist())
    return keys


def _parts_count(root: Path) -> int:
    return len(list(root.rglob("part-*.parquet"))) if root.exists() else 0


def append_frame_v6(
    frame: pd.DataFrame,
    *,
    provider: str,
    symbol: str,
    mode: str,
    timeframe: str,
    base_timeframe: str | None = None,
    anchor: str | None = None,
    store_root: str | Path | None = None,
    manifest_extra: dict[str, Any] | None = None,
    deduplicate_existing_key: bool = True,
) -> dict[str, Any]:
    root = ensure_store_layout(store_root)
    key = dataset_key(provider=provider, symbol=symbol, mode=mode, timeframe=timeframe, base_timeframe=base_timeframe, anchor=anchor)
    rel_root = dataset_relative_root(provider=provider, symbol=symbol, mode=mode, timeframe=timeframe, base_timeframe=base_timeframe, anchor=anchor)
    ds_root = dataset_root(provider=provider, symbol=symbol, mode=mode, timeframe=timeframe, base_timeframe=base_timeframe, anchor=anchor, store_root=root)
    rows_written = 0
    duplicate_rows = 0
    written_files: list[str] = []
    columns = RAW_COLUMNS if mode == "raw" else CLEAN_COLUMNS if mode == "clean" else AGGREGATED_COLUMNS
    df = frame.copy()
    if not df.empty:
        ts = pd.to_datetime(df["openTime"], unit="s", utc=True)
        df["_year"] = ts.dt.year.astype("int32")
        df["_month"] = ts.dt.month.astype("int32")
        for (_year, _month), partition_df in df.groupby(["_year", "_month"], sort=True):
            partition_dir = ds_root / f"year={int(_year):04d}" / f"month={int(_month):02d}"
            partition_dir.mkdir(parents=True, exist_ok=True)
            if deduplicate_existing_key:
                existing = _existing_keys(partition_dir)
                before = len(partition_df)
                partition_df = partition_df[~partition_df["barKey"].isin(existing)]
                duplicate_rows += before - len(partition_df)
            if partition_df.empty:
                continue
            first_time = int(partition_df["openTime"].min())
            part_name = f"part-{pd.to_datetime(first_time, unit='s', utc=True).strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}.parquet"
            out = partition_dir / part_name
            partition_df[columns].to_parquet(out, index=False, engine="pyarrow")
            rows_written += len(partition_df)
            written_files.append(str(out))

    manifest = load_manifest_v6(root)
    previous = manifest["datasets"].get(key, {})
    previous_rows = int(previous.get("rowsCount") or 0)
    first_time = previous.get("firstOpenTime")
    last_time = previous.get("lastOpenTime")
    if not df.empty and rows_written:
        written_min = int(df["openTime"].min())
        written_max = int(df["openTime"].max())
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
        "firstOpenTime": first_time,
        "lastOpenTime": last_time,
        "firstTime": first_time,
        "lastTime": last_time,
        "status": "ready",
        "dirty": False,
        "schemaVersion": SCHEMA_VERSION,
        "storeVersion": STORE_VERSION,
        "updatedAt": utc_now_iso(),
    }
    if manifest_extra:
        cell.update(manifest_extra)
    manifest["datasets"][key] = cell
    manifest.setdefault("symbols", {}).setdefault(symbol, {"symbol": symbol})
    manifest["symbols"][symbol]["updatedAt"] = utc_now_iso()
    save_manifest_v6(manifest, root)
    return {"ok": True, "datasetKey": key, "rowsWritten": rows_written, "duplicateRows": duplicate_rows, "writtenFiles": written_files, "manifestCell": cell}


def append_raw_rows_v6(rows: list[dict[str, Any]], *, provider: str = "mt5", symbol: str, store_root: str | Path | None = None, manifest_extra: dict[str, Any] | None = None) -> dict[str, Any]:
    return append_frame_v6(
        normalize_raw_rows(rows),
        provider=provider,
        symbol=symbol,
        mode="raw",
        timeframe="M1",
        store_root=store_root,
        manifest_extra=manifest_extra,
        deduplicate_existing_key=True,
    )

