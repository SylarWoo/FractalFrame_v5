from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any, Mapping

import pandas as pd

from .manifest_v5 import load_manifest_v5, save_manifest_v5
from .ohlcv_schema_v5 import CANONICAL_COLUMNS
from .partitioned_parquet_writer_v5 import append_ohlcv_part_v5
from .store_v5_paths import (
    SCHEMA_VERSION,
    STORE_VERSION,
    dataset_key,
    dataset_relative_root,
    dataset_root,
    resolve_store_root,
)


def _iter_month_partitions(root: Path) -> list[tuple[int, int, Path]]:
    if not root.is_dir():
        return []
    out: list[tuple[int, int, Path]] = []
    for month_dir in root.glob("year=*/month=*"):
        if not month_dir.is_dir():
            continue
        try:
            year_text = month_dir.parent.name.split("=", 1)[1]
            month_text = month_dir.name.split("=", 1)[1]
            out.append((int(year_text), int(month_text), month_dir.resolve()))
        except Exception:
            continue
    return sorted(out, key=lambda item: (item[0], item[1]))


def _read_parquet_best_effort(path: Path) -> pd.DataFrame:
    try:
        frame = pd.read_parquet(path, engine="pyarrow")
    except Exception:
        return pd.DataFrame()
    return frame if isinstance(frame, pd.DataFrame) else pd.DataFrame()


def _safe_records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    if frame.empty or "time" not in frame.columns:
        return []
    cols = [col for col in CANONICAL_COLUMNS if col in frame.columns]
    return frame[cols].to_dict("records")


def _write_prefix_manifest_cell(
    *,
    store_root: Path,
    provider: str,
    symbol: str,
    mode: str,
    timeframe: str,
    base_timeframe: str | None,
    anchor: str | None,
    old_cell: dict[str, Any] | None,
    rows_count: int,
    parts_count: int,
    rebuild_start: int,
    manifest_extra: dict[str, Any] | None,
) -> dict[str, Any]:
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
    first_time = old_cell.get("firstTime") if isinstance(old_cell, dict) and rows_count > 0 else None
    cell: dict[str, Any] = {
        **(old_cell or {}),
        "provider": provider,
        "symbol": symbol,
        "mode": mode,
        "timeframe": timeframe,
        "baseTimeframe": base_timeframe,
        "anchor": anchor,
        "rootPath": rel_root.as_posix(),
        "rowsCount": max(0, int(rows_count)),
        "partsCount": max(0, int(parts_count)),
        "firstTime": first_time,
        "lastTime": int(rebuild_start) - 1 if rows_count > 0 else None,
        "lastPartPath": old_cell.get("lastPartPath") if isinstance(old_cell, dict) and parts_count > 0 else None,
        "status": "ready",
        "dirty": False,
        "schemaVersion": SCHEMA_VERSION,
        "storeVersion": STORE_VERSION,
    }
    if manifest_extra:
        cell.update(manifest_extra)
    manifest = load_manifest_v5(store_root)
    manifest.setdefault("datasets", {})[key] = cell
    save_manifest_v5(manifest, store_root)
    return cell


def replace_ohlcv_tail_partitions_v5(
    tail_rows: list[Mapping[str, Any]] | pd.DataFrame,
    *,
    provider: str,
    symbol: str,
    mode: str,
    timeframe: str,
    base_timeframe: str | None,
    anchor: str | None,
    rebuild_start: int,
    store_root: str | Path | None = None,
    source: str = "store_v5_m1_aggregate_tail_partition_replace",
    manifest_extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    root = resolve_store_root(store_root)
    sym = str(symbol or "").strip()
    tf = str(timeframe or "").strip().upper()
    ds_root = dataset_root(
        provider=provider,
        symbol=sym,
        mode=mode,
        timeframe=tf,
        base_timeframe=base_timeframe,
        anchor=anchor,
        store_root=root,
    )
    key = dataset_key(
        provider=provider,
        symbol=sym,
        mode=mode,
        timeframe=tf,
        base_timeframe=base_timeframe,
        anchor=anchor,
    )
    manifest = load_manifest_v5(root)
    old_cell = manifest.get("datasets", {}).get(key)
    old_rows_count = int(old_cell.get("rowsCount") or 0) if isinstance(old_cell, dict) else 0
    old_parts_count = int(old_cell.get("partsCount") or 0) if isinstance(old_cell, dict) else 0

    cutoff = pd.to_datetime(int(rebuild_start), unit="s", utc=True)
    cutoff_year = int(cutoff.year)
    cutoff_month = int(cutoff.month)

    carried_rows: list[dict[str, Any]] = []
    affected_rows_count = 0
    affected_parts_count = 0
    affected_partitions: list[str] = []
    for year, month, part_dir in _iter_month_partitions(ds_root):
        if (year, month) < (cutoff_year, cutoff_month):
            continue
        affected_partitions.append(part_dir.relative_to(ds_root).as_posix())
        for part_path in sorted(part_dir.glob("part-*.parquet")):
            affected_parts_count += 1
            frame = _read_parquet_best_effort(part_path)
            affected_rows_count += int(len(frame))
            if frame.empty or "time" not in frame.columns or (year, month) != (cutoff_year, cutoff_month):
                continue
            keep = frame.loc[frame["time"].astype("int64") < int(rebuild_start)].copy()
            carried_rows.extend(_safe_records(keep))
        shutil.rmtree(part_dir, ignore_errors=True)

    if ds_root.is_dir():
        for year_dir in sorted(ds_root.glob("year=*")):
            try:
                if year_dir.is_dir() and not any(year_dir.iterdir()):
                    year_dir.rmdir()
            except Exception:
                continue

    remaining_rows_count = max(0, old_rows_count - affected_rows_count)
    remaining_parts_count = max(0, old_parts_count - affected_parts_count)
    _write_prefix_manifest_cell(
        store_root=root,
        provider=provider,
        symbol=sym,
        mode=mode,
        timeframe=tf,
        base_timeframe=base_timeframe,
        anchor=anchor,
        old_cell=old_cell if isinstance(old_cell, dict) else None,
        rows_count=remaining_rows_count,
        parts_count=remaining_parts_count,
        rebuild_start=int(rebuild_start),
        manifest_extra=manifest_extra,
    )

    if isinstance(tail_rows, pd.DataFrame):
        tail_records = _safe_records(tail_rows)
    else:
        tail_records = [dict(row) for row in (tail_rows or [])]
    rows_to_write = carried_rows + tail_records
    if rows_to_write:
        write = append_ohlcv_part_v5(
            rows_to_write,
            provider=provider,
            symbol=sym,
            mode=mode,
            timeframe=tf,
            base_timeframe=base_timeframe,
            anchor=anchor,
            store_root=root,
            source=source,
            deduplicate_existing_time=False,
            manifest_extra=manifest_extra,
        )
    else:
        write = {"ok": True, "rowsWritten": 0, "partsWritten": 0, "writtenFiles": []}

    cell_post = load_manifest_v5(root).get("datasets", {}).get(key) or {}
    rows_count = int(cell_post.get("rowsCount") or 0)
    parts_count = int(cell_post.get("partsCount") or 0)
    return {
        "ok": write.get("ok") is True,
        "status": "store_v5_tail_partition_replace_ok" if write.get("ok") is True else "store_v5_tail_partition_replace_failed",
        "datasetKey": key,
        "rowsWritten": rows_count,
        "rowsPhysicalWritten": int(write.get("rowsWritten") or 0),
        "rowsCount": rows_count,
        "partsCount": parts_count,
        "timeFrom": cell_post.get("firstTime"),
        "timeTo": cell_post.get("lastTime"),
        "writtenFiles": list(write.get("writtenFiles") or []),
        "affectedPartitions": affected_partitions,
        "affectedOldRowsCount": affected_rows_count,
        "affectedOldPartsCount": affected_parts_count,
        "carriedPrefixRowsCount": len(carried_rows),
        "prefixRowsCount": remaining_rows_count + len(carried_rows),
        "tailRowsPhysicalCount": len(tail_records),
        "rebuildStart": int(rebuild_start),
        "manifestCell": cell_post,
    }
