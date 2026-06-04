from __future__ import annotations

from pathlib import Path
from typing import Any

import duckdb

from ..aggregate.aggregation_anchor_v1 import ANCHOR_UTC2200, FIXED_SECONDS, month_anchor_start, week_anchor_start
from .manifest_v6 import load_manifest_v6, save_manifest_v6, utc_now_iso
from .paths_v6 import dataset_root, resolve_store_root
from .schema_v6 import normalize_period


def _bucket_start(value: int, period: str, anchor: str) -> int | None:
    period = normalize_period(period)
    if period == "MN":
        return month_anchor_start(value, anchor)
    if period == "W1":
        return week_anchor_start(value, anchor)
    seconds = FIXED_SECONDS.get(period)
    if not seconds:
        return None
    offset = 22 * 3600 if anchor == ANCHOR_UTC2200 else 0
    return ((int(value) - offset) // int(seconds)) * int(seconds) + offset


def _dataset_files(cell: dict[str, Any], store_root: Path) -> list[str]:
    try:
        root = dataset_root(
            provider=cell["provider"],
            symbol=cell["symbol"],
            mode=cell["mode"],
            timeframe=cell["timeframe"],
            base_timeframe=cell.get("baseTimeframe"),
            anchor=cell.get("anchor"),
            store_root=store_root,
        )
    except Exception:
        rel = cell.get("rootPath")
        root = store_root / str(rel) if rel else store_root / "__missing__"
    return sorted(str(path) for path in root.rglob("part-*.parquet")) if root.exists() else []


def _parquet_stats(files: list[str]) -> dict[str, Any]:
    if not files:
        return {"partsCount": 0, "rowsCount": 0, "firstOpenTime": None, "lastOpenTime": None}
    con = duckdb.connect(database=":memory:")
    try:
        row = con.execute(
            """
            WITH ranked AS (
              SELECT
                openTime,
                barKey,
                ROW_NUMBER() OVER (
                  PARTITION BY barKey
                  ORDER BY volume DESC, ABS(high - low) DESC, filename DESC
                ) AS row_rank
              FROM read_parquet(?, filename=true, union_by_name=true)
            )
            SELECT COUNT(*), MIN(openTime), MAX(openTime)
            FROM ranked
            WHERE row_rank = 1
            """,
            [files],
        ).fetchone()
        return {
            "partsCount": len(files),
            "rowsCount": int(row[0] or 0),
            "firstOpenTime": None if row[1] is None else int(row[1]),
            "lastOpenTime": None if row[2] is None else int(row[2]),
        }
    finally:
        con.close()


def audit_store_v6(symbol: str, *, store_root: str | Path | None = None, repair: bool = False) -> dict[str, Any]:
    root = resolve_store_root(store_root)
    manifest = load_manifest_v6(root)
    datasets = manifest.get("datasets", {})
    clean_cell = next(
        (
            cell for cell in datasets.values()
            if cell.get("symbol") == symbol and cell.get("mode") == "clean" and normalize_period(cell.get("timeframe")) == "M1"
        ),
        None,
    )
    clean_last_time = clean_cell.get("lastOpenTime") if isinstance(clean_cell, dict) else None
    checked: list[dict[str, Any]] = []
    repaired_count = 0
    issue_count = 0

    for key, cell in sorted(datasets.items()):
        if cell.get("symbol") != symbol:
            continue
        files = _dataset_files(cell, root)
        stats = _parquet_stats(files)
        issues: list[str] = []
        for field in ["rowsCount", "partsCount", "firstOpenTime", "lastOpenTime"]:
            if cell.get(field) != stats.get(field):
                issues.append(f"{field}_mismatch")
        if cell.get("firstTime") != stats.get("firstOpenTime"):
            issues.append("firstTime_mismatch")
        if cell.get("lastTime") != stats.get("lastOpenTime"):
            issues.append("lastTime_mismatch")
        if cell.get("mode") == "aggregated" and isinstance(clean_last_time, int):
            period = normalize_period(str(cell.get("timeframe") or ""))
            expected_bucket = _bucket_start(clean_last_time, period, str(cell.get("anchor") or ANCHOR_UTC2200))
            actual_last = stats.get("lastOpenTime")
            if isinstance(expected_bucket, int) and (not isinstance(actual_last, int) or actual_last < expected_bucket):
                issues.append("aggregated_last_bar_behind_clean_bucket")
        changed = False
        if repair and issues:
            cell["rowsCount"] = stats["rowsCount"]
            cell["partsCount"] = stats["partsCount"]
            cell["firstOpenTime"] = stats["firstOpenTime"]
            cell["lastOpenTime"] = stats["lastOpenTime"]
            cell["firstTime"] = stats["firstOpenTime"]
            cell["lastTime"] = stats["lastOpenTime"]
            cell["updatedAt"] = utc_now_iso()
            if "aggregated_last_bar_behind_clean_bucket" in issues:
                cell["dirty"] = True
            changed = True
            repaired_count += 1
        if issues:
            issue_count += 1
        checked.append({
            "datasetKey": key,
            "mode": cell.get("mode"),
            "timeframe": cell.get("timeframe"),
            "issues": issues,
            "manifest": {
                "rowsCount": cell.get("rowsCount"),
                "partsCount": cell.get("partsCount"),
                "firstOpenTime": cell.get("firstOpenTime"),
                "lastOpenTime": cell.get("lastOpenTime"),
                "dirty": cell.get("dirty"),
            },
            "parquet": stats,
            "repaired": changed,
        })

    if repair and repaired_count:
        save_manifest_v6(manifest, root)
    return {
        "ok": True,
        "status": "store_v6_audit_repaired" if repair else "store_v6_audit_completed",
        "symbol": symbol,
        "storeRoot": str(root),
        "checkedDatasets": len(checked),
        "issueDatasets": issue_count,
        "repairedDatasets": repaired_count,
        "datasets": checked,
        "publishedAt": utc_now_iso(),
    }
