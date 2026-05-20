from __future__ import annotations

from pathlib import Path
from typing import Any

import duckdb

from .manifest_v5 import load_manifest_v5, save_manifest_v5
from .store_v5_paths import resolve_store_root


def _part_files(root: Path) -> list[str]:
    return sorted(str(path) for path in root.rglob("part-*.parquet"))


def _audit_dataset(store_root: Path, key: str, cell: dict[str, Any]) -> dict[str, Any]:
    rel_root = str(cell.get("rootPath") or "")
    ds_root = (store_root / rel_root).resolve()
    files = _part_files(ds_root)
    issues: list[str] = []
    if not rel_root or not ds_root.exists():
        return {"datasetKey": key, "ok": False, "issues": ["dataset_root_missing"], "manifestRowsCount": cell.get("rowsCount"), "actualRowsCount": 0}
    if not files:
        return {"datasetKey": key, "ok": False, "issues": ["parquet_parts_missing"], "manifestRowsCount": cell.get("rowsCount"), "actualRowsCount": 0}

    con = duckdb.connect(database=":memory:")
    try:
        stats = con.execute(
            """
            WITH rows AS (
              SELECT time, open, high, low, close, volume
              FROM read_parquet(?)
            ),
            ordered AS (
              SELECT
                time,
                open,
                high,
                low,
                close,
                volume,
                LAG(time) OVER (ORDER BY time) AS prev_time
              FROM rows
            )
            SELECT
              COUNT(*) AS actual_rows,
              COUNT(DISTINCT time) AS distinct_times,
              SUM(CASE WHEN time IS NULL OR open IS NULL OR high IS NULL OR low IS NULL OR close IS NULL THEN 1 ELSE 0 END) AS null_ohlc_rows,
              SUM(CASE WHEN high < low OR open > high OR open < low OR close > high OR close < low THEN 1 ELSE 0 END) AS invalid_ohlc_rows,
              SUM(CASE WHEN prev_time IS NOT NULL AND time < prev_time THEN 1 ELSE 0 END) AS descending_rows,
              MIN(time) AS first_time,
              MAX(time) AS last_time
            FROM ordered
            """,
            [files],
        ).fetchone()
    finally:
        con.close()

    actual_rows = int(stats[0] or 0)
    distinct_times = int(stats[1] or 0)
    manifest_rows = cell.get("rowsCount")
    if manifest_rows is not None and int(manifest_rows) != actual_rows:
        issues.append("manifest_rows_count_mismatch")
    if distinct_times != actual_rows:
        issues.append("duplicate_time")
    if int(stats[2] or 0):
        issues.append("null_ohlc")
    if int(stats[3] or 0):
        issues.append("invalid_ohlc")
    if int(stats[4] or 0):
        issues.append("time_not_monotonic")

    return {
        "datasetKey": key,
        "ok": not issues,
        "issues": issues,
        "manifestRowsCount": manifest_rows,
        "actualRowsCount": actual_rows,
        "distinctTimes": distinct_times,
        "firstTime": int(stats[5]) if stats[5] is not None else None,
        "lastTime": int(stats[6]) if stats[6] is not None else None,
        "parquetParts": len(files),
    }


def _repair_manifest_counts(manifest: dict[str, Any], reports: list[dict[str, Any]]) -> list[dict[str, Any]]:
    repairs: list[dict[str, Any]] = []
    datasets = manifest.get("datasets", {})
    for report in reports:
        if "manifest_rows_count_mismatch" not in report.get("issues", []):
            continue
        key = str(report.get("datasetKey"))
        cell = datasets.get(key)
        if not cell:
            continue
        old = cell.get("rowsCount")
        new = report.get("actualRowsCount")
        cell["rowsCount"] = new
        repairs.append({"datasetKey": key, "field": "rowsCount", "old": old, "new": new})
    return repairs


def audit_store_v5(*, symbol: str | None = None, store_root: str | Path | None = None, repair: bool = False) -> dict[str, Any]:
    root = resolve_store_root(store_root)
    manifest = load_manifest_v5(root)
    datasets = manifest.get("datasets", {})
    reports = [
        _audit_dataset(root, key, cell)
        for key, cell in datasets.items()
        if not symbol or cell.get("symbol") == symbol
    ]
    repairs = _repair_manifest_counts(manifest, reports) if repair else []
    if repairs:
        save_manifest_v5(manifest, root)
    issues = [report for report in reports if not report.get("ok")]
    return {
        "ok": not issues or bool(repairs),
        "status": "store_v5_audit_repaired" if repairs else ("store_v5_audit_ok" if not issues else "store_v5_audit_issues"),
        "symbol": symbol,
        "datasetsCount": len(reports),
        "issuesCount": len(issues),
        "repairs": repairs,
        "datasets": reports,
    }
