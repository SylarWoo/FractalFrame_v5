from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

import pandas as pd

from ..store_v5.manifest_v5 import load_manifest_v5, save_manifest_v5, utc_now_iso
from ..store_v5.partitioned_parquet_writer_v5 import append_ohlcv_part_v5
from ..store_v5.store_v5_paths import dataset_key, dataset_root, resolve_store_root
from .aggregation_anchor_v1 import (
    ANCHOR_UTC2200,
    SUPPORTED_TIMEFRAMES,
    expected_minutes_for_bucket,
    fixed_bucket_start,
    month_anchor_start,
)


def _direct_ready(cell: dict[str, Any] | None) -> bool:
    if not cell:
        return False
    return (
        cell.get("m1IntegrityStatus") in {"true_m1_continuous", "true_m1_with_session_gaps", "true_m1_truncated_at_gap"}
        and cell.get("firstHourM1CheckOk") is True
        and cell.get("rowsCount") == cell.get("trueM1RowsCount")
        and cell.get("firstAnchorTime") is not None
        and cell.get("lastTrueM1Time") is not None
    )


def _read_direct_m1(store_root: Path, symbol: str) -> pd.DataFrame:
    root = dataset_root(provider="mt5", symbol=symbol, mode="direct", timeframe="M1", store_root=store_root)
    files = list(root.rglob("part-*.parquet"))
    if not files:
        return pd.DataFrame()
    return pd.concat([pd.read_parquet(file) for file in files], ignore_index=True).sort_values("time")


def _aggregate(df: pd.DataFrame, timeframe: str, anchor: str) -> pd.DataFrame:
    work = df.sort_values("time").copy()
    if timeframe == "MN1":
        work["bucket"] = work["time"].map(lambda v: month_anchor_start(int(v), anchor))
    else:
        work["bucket"] = work["time"].map(lambda v: fixed_bucket_start(int(v), timeframe, anchor))
    grouped = work.groupby("bucket", sort=True)
    rows: list[dict[str, Any]] = []
    for bucket, group in grouped:
        expected = expected_minutes_for_bucket(int(bucket), timeframe, anchor)
        if len(group) != expected:
            continue
        rows.append(
            {
                "time": int(bucket),
                "open": float(group.iloc[0]["open"]),
                "high": float(group["high"].max()),
                "low": float(group["low"].min()),
                "close": float(group.iloc[-1]["close"]),
                "volume": int(group["volume"].sum()),
            }
        )
    return pd.DataFrame(rows)


def aggregate_from_m1_store_v5(
    *,
    symbol: str,
    target_timeframes: list[str],
    store_root: str | Path | None = None,
    anchor: str = ANCHOR_UTC2200,
    rebuild: bool = False,
) -> dict[str, Any]:
    root = resolve_store_root(store_root)
    manifest = load_manifest_v5(root)
    direct_key = dataset_key(provider="mt5", symbol=symbol, mode="direct", timeframe="M1")
    direct_cell = manifest.get("datasets", {}).get(direct_key)
    if not _direct_ready(direct_cell):
        return {"ok": False, "error": "direct_m1_integrity_not_ready", "symbol": symbol}

    source_df = _read_direct_m1(root, symbol)
    if source_df.empty:
        return {"ok": False, "error": "direct_m1_dataset_empty", "symbol": symbol}

    results: dict[str, Any] = {}
    for timeframe in target_timeframes:
        timeframe = timeframe.strip().upper()
        if timeframe not in SUPPORTED_TIMEFRAMES:
            results[timeframe] = {"ok": False, "error": "unsupported_timeframe"}
            continue
        aggr_key = dataset_key(
            provider="mt5",
            symbol=symbol,
            mode="aggregated",
            timeframe=timeframe,
            base_timeframe="M1",
            anchor=anchor,
        )
        aggr_root = dataset_root(
            provider="mt5",
            symbol=symbol,
            mode="aggregated",
            timeframe=timeframe,
            base_timeframe="M1",
            anchor=anchor,
            store_root=root,
        )
        if rebuild and aggr_root.exists():
            shutil.rmtree(aggr_root)
            manifest = load_manifest_v5(root)
            manifest.get("datasets", {}).pop(aggr_key, None)
            save_manifest_v5(manifest, root)

        out_df = _aggregate(source_df, timeframe, anchor)
        extra = {
            "sourceDataset": direct_key,
            "sourceFirstTime": direct_cell.get("firstTime"),
            "sourceLastTime": direct_cell.get("lastTrueM1Time"),
            "sourceTrueM1RowsCount": direct_cell.get("trueM1RowsCount"),
            "lastAggregateAt": utc_now_iso(),
            "status": "ready",
            "dirty": False,
        }
        write = append_ohlcv_part_v5(
            out_df.to_dict("records"),
            provider="mt5",
            symbol=symbol,
            mode="aggregated",
            timeframe=timeframe,
            base_timeframe="M1",
            anchor=anchor,
            store_root=root,
            source="store_v5_m1_aggregate",
            deduplicate_existing_time=True,
            manifest_extra=extra,
        )
        results[timeframe] = {
            "ok": True,
            "rowsCount": write["manifestCell"].get("rowsCount"),
            "rowsWritten": write["rowsWritten"],
            "sourceLastTime": direct_cell.get("lastTrueM1Time"),
            "sourceTrueM1RowsCount": direct_cell.get("trueM1RowsCount"),
            "anchor": anchor,
            "dirty": False,
        }
    return {"ok": True, "symbol": symbol, "storeVersion": "v5", "results": results}
