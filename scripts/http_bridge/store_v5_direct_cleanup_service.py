from __future__ import annotations

from pathlib import Path
from typing import Any


def cleanup_direct_m1_prefix_before_time_v5(root: Path, symbol: str, cutoff_time: int, manifest_extra: dict[str, Any]) -> dict[str, Any]:
    import pandas as pd

    from python.data_warehouse.store_v5.manifest_v5 import load_manifest_v5, save_manifest_v5
    from python.data_warehouse.store_v5.ohlcv_schema_v5 import CANONICAL_COLUMNS
    from python.data_warehouse.store_v5.store_v5_paths import (
        SCHEMA_VERSION,
        STORE_VERSION,
        dataset_key,
        dataset_relative_root,
        dataset_root,
    )

    key = dataset_key(provider="mt5", symbol=symbol, mode="direct", timeframe="M1")
    rel_root = dataset_relative_root(provider="mt5", symbol=symbol, mode="direct", timeframe="M1")
    ds_root = dataset_root(provider="mt5", symbol=symbol, mode="direct", timeframe="M1", store_root=root)
    deleted_rows = 0
    kept_rows = 0
    parts_count = 0
    first_time = None
    last_time = None

    for file in list(ds_root.rglob("part-*.parquet")):
        frame = pd.read_parquet(file)
        before = int(len(frame))
        if before <= 0:
            file.unlink(missing_ok=True)
            continue
        frame = frame[frame["time"].astype("int64") >= int(cutoff_time)]
        deleted_rows += before - int(len(frame))
        if frame.empty:
            file.unlink(missing_ok=True)
            continue
        tmp = file.with_name(f"{file.name}.tmp")
        frame[CANONICAL_COLUMNS].to_parquet(tmp, index=False)
        tmp.replace(file)
        kept_rows += int(len(frame))
        parts_count += 1
        file_first = int(frame["time"].min())
        file_last = int(frame["time"].max())
        first_time = file_first if first_time is None else min(first_time, file_first)
        last_time = file_last if last_time is None else max(last_time, file_last)

    manifest = load_manifest_v5(root)
    cell = {
        **manifest.get("datasets", {}).get(key, {}),
        "provider": "mt5",
        "symbol": symbol,
        "mode": "direct",
        "timeframe": "M1",
        "baseTimeframe": None,
        "anchor": None,
        "rootPath": rel_root.as_posix(),
        "rowsCount": int(manifest_extra.get("trueM1RowsCount") or kept_rows),
        "partsCount": parts_count,
        "firstTime": first_time,
        "lastTime": last_time,
        "status": "ready",
        "dirty": False,
        "schemaVersion": SCHEMA_VERSION,
        "storeVersion": STORE_VERSION,
        **manifest_extra,
    }
    cell["rowsCount"] = int(cell.get("trueM1RowsCount") or kept_rows)
    manifest.setdefault("datasets", {})[key] = cell
    save_manifest_v5(manifest, root)
    return {
        "deletedRows": deleted_rows,
        "keptRows": kept_rows,
        "partsCount": parts_count,
        "firstTime": first_time,
        "lastTime": last_time,
    }
