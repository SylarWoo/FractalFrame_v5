from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

import duckdb
import pandas as pd

from ..store_v5.manifest_v5 import load_manifest_v5, save_manifest_v5, utc_now_iso
from ..store_v5.partitioned_parquet_tail_replace_v5 import replace_ohlcv_tail_partitions_v5
from ..store_v5.partitioned_parquet_writer_v5 import append_ohlcv_part_v5
from ..store_v5.store_v5_paths import dataset_key, dataset_root, resolve_store_root
from .aggregation_anchor_v1 import (
    ANCHOR_UTC2200,
    FIXED_SECONDS,
    SUPPORTED_TIMEFRAMES,
    expected_minutes_for_bucket,
    fixed_bucket_start,
    month_anchor_start,
    week_anchor_start,
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


def _read_direct_m1(store_root: Path, symbol: str, time_from: int | None = None) -> pd.DataFrame:
    root = dataset_root(provider="mt5", symbol=symbol, mode="direct", timeframe="M1", store_root=store_root)
    files = sorted(str(file) for file in root.rglob("part-*.parquet"))
    if not files:
        return pd.DataFrame()
    con = duckdb.connect(database=":memory:")
    try:
        if time_from is None:
            return con.execute(
                "SELECT time, open, high, low, close, volume FROM read_parquet(?) ORDER BY time",
                [files],
            ).fetchdf()
        return con.execute(
            "SELECT time, open, high, low, close, volume FROM read_parquet(?) WHERE time >= ? ORDER BY time",
            [files, int(time_from)],
        ).fetchdf()
    finally:
        con.close()


def _incremental_m1_start_time(last_aggregated_time: int | None, timeframe: str, anchor: str) -> int | None:
    if last_aggregated_time is None:
        return None
    return int(last_aggregated_time)


def _aggregate(df: pd.DataFrame, timeframe: str, anchor: str) -> pd.DataFrame:
    work = df.sort_values("time").copy()
    if timeframe == "MN1":
        work["bucket"] = work["time"].map(lambda v: month_anchor_start(int(v), anchor))
    elif timeframe == "W1":
        work["bucket"] = work["time"].map(lambda v: week_anchor_start(int(v), anchor))
    else:
        seconds = int(FIXED_SECONDS[timeframe])
        offset = 22 * 3600 if anchor == ANCHOR_UTC2200 else 0
        times = work["time"].astype("int64")
        work["bucket"] = (((times - offset) // seconds) * seconds + offset).astype("int64")
    grouped = work.groupby("bucket", sort=True, observed=True)
    last_bucket = int(work["bucket"].max()) if not work.empty else None
    if last_bucket is None:
        return pd.DataFrame(columns=["time", "open", "high", "low", "close", "volume"])

    out = grouped.agg(
        open=("open", "first"),
        high=("high", "max"),
        low=("low", "min"),
        close=("close", "last"),
        volume=("volume", "sum"),
        rowsInBucket=("time", "size"),
    ).reset_index(drop=False).rename(columns={"bucket": "time"})

    if timeframe in {"D1", "W1", "MN1"}:
        out = out[["time", "open", "high", "low", "close", "volume"]].copy()
        out["time"] = out["time"].astype("int64")
        out["volume"] = out["volume"].astype("int64")
        return out

    if timeframe == "MN1":
        expected = out["time"].map(lambda v: expected_minutes_for_bucket(int(v), timeframe, anchor)).astype("int64")
    else:
        expected = int(FIXED_SECONDS[timeframe] // 60)
    keep = (out["rowsInBucket"] == expected) | (out["time"].astype("int64") == last_bucket)
    out = out.loc[keep, ["time", "open", "high", "low", "close", "volume"]].copy()
    out["time"] = out["time"].astype("int64")
    out["volume"] = out["volume"].astype("int64")
    return out


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
        raw_key = dataset_key(provider="mt5", symbol=symbol, mode="raw_direct", timeframe="M1")
        raw_cell = manifest.get("datasets", {}).get(raw_key)
        if raw_cell and not direct_cell:
            return {
                "ok": False,
                "error": "direct_m1_missing_clean_raw_m1_first",
                "status": "raw_m1_ready_clean_pending",
                "symbol": symbol,
            }
        return {"ok": False, "error": "direct_m1_integrity_not_ready", "symbol": symbol}

    results: dict[str, Any] = {}
    full_source_df: pd.DataFrame | None = None
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
        aggr_cell = manifest.get("datasets", {}).get(aggr_key)
        if rebuild and aggr_root.exists():
            shutil.rmtree(aggr_root)
            manifest = load_manifest_v5(root)
            manifest.get("datasets", {}).pop(aggr_key, None)
            save_manifest_v5(manifest, root)
            aggr_cell = None

        incremental_start_time = None
        if not rebuild and aggr_cell:
            incremental_start_time = _incremental_m1_start_time(
                int(aggr_cell["lastTime"]) if aggr_cell.get("lastTime") is not None else None,
                timeframe,
                anchor,
            )

        if incremental_start_time is None:
            if full_source_df is None:
                full_source_df = _read_direct_m1(root, symbol, time_from=None)
            source_df = full_source_df
        else:
            source_df = _read_direct_m1(root, symbol, time_from=incremental_start_time)
        if source_df.empty:
            results[timeframe] = {
                "ok": True,
                "status": "no_new_m1_rows_for_incremental_aggregate",
                "rowsCount": aggr_cell.get("rowsCount") if aggr_cell else 0,
                "rowsWritten": 0,
                "sourceLastTime": direct_cell.get("lastTrueM1Time"),
                "sourceTrueM1RowsCount": direct_cell.get("trueM1RowsCount"),
                "anchor": anchor,
                "dirty": False,
                "incremental": bool(incremental_start_time),
                "incrementalStartTime": incremental_start_time,
            }
            continue

        out_df = _aggregate(source_df, timeframe, anchor)
        extra = {
            "sourceDataset": direct_key,
            "sourceFirstTime": direct_cell.get("firstTime"),
            "sourceLastTime": direct_cell.get("lastTrueM1Time"),
            "sourceTrueM1RowsCount": direct_cell.get("trueM1RowsCount"),
            "lastAggregateAt": utc_now_iso(),
            "lastAggregateMode": "rebuild" if rebuild or not aggr_cell else "incremental",
            "lastAggregateM1StartTime": int(source_df["time"].min()) if not source_df.empty else None,
            "lastAggregateM1RowsCount": int(len(source_df)),
            "status": "ready",
            "dirty": False,
        }
        if incremental_start_time is not None:
            write = replace_ohlcv_tail_partitions_v5(
                out_df,
                provider="mt5",
                symbol=symbol,
                mode="aggregated",
                timeframe=timeframe,
                base_timeframe="M1",
                anchor=anchor,
                rebuild_start=incremental_start_time,
                store_root=root,
                source="store_v5_m1_aggregate_tail_partition_replace",
                manifest_extra=extra,
            )
        else:
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
        manifest_cell = write.get("manifestCell") if isinstance(write.get("manifestCell"), dict) else {}
        results[timeframe] = {
            "ok": True,
            "rowsCount": manifest_cell.get("rowsCount") or write.get("rowsCount"),
            "rowsWritten": write.get("rowsWritten"),
            "rowsPhysicalWritten": write.get("rowsPhysicalWritten") or write.get("rowsWritten"),
            "sourceLastTime": direct_cell.get("lastTrueM1Time"),
            "sourceTrueM1RowsCount": direct_cell.get("trueM1RowsCount"),
            "anchor": anchor,
            "dirty": False,
            "incremental": bool(incremental_start_time),
            "incrementalStartTime": incremental_start_time,
            "lastAggregateM1RowsCount": int(len(source_df)),
            "lastAggregateTruncatedRowsCount": write.get("affectedOldRowsCount") if incremental_start_time is not None else None,
            "tailAggregatedRowsCount": int(len(out_df)),
            "affectedPartitions": write.get("affectedPartitions") or [],
            "affectedOldRowsCount": write.get("affectedOldRowsCount") or 0,
            "carriedPrefixRowsCount": write.get("carriedPrefixRowsCount") or 0,
            "prefixRowsCount": write.get("prefixRowsCount") or 0,
            "writeMode": "tail_partition_replace" if incremental_start_time is not None else "full_append",
        }
    return {"ok": True, "symbol": symbol, "storeVersion": "v5", "results": results}
