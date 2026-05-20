from __future__ import annotations

import argparse
import json
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from python.data_warehouse.aggregate.aggregate_from_m1_service_v1 import aggregate_from_m1_store_v5
from python.data_warehouse.query.duckdb_ohlcv_query_v5 import query_ohlcv_store_v5
from python.data_warehouse.store_v5.partitioned_parquet_writer_v5 import append_ohlcv_part_v5


ANCHOR = 1735768800


def make_rows(count: int) -> list[dict]:
    return [
        {
            "time": ANCHOR + index * 60,
            "open": float(index),
            "high": float(index + 2),
            "low": float(index - 1),
            "close": float(index + 1),
            "volume": index + 10,
        }
        for index in range(count)
    ]


def timed(label: str, fn):
    start = time.perf_counter()
    payload = fn()
    elapsed = time.perf_counter() - start
    return label, elapsed, payload


def run_benchmark(rows_count: int, store_root: Path) -> dict:
    rows = make_rows(rows_count)
    extra = {
        "mt5RowsCount": rows_count,
        "trueM1RowsCount": rows_count,
        "firstAnchorTime": rows[0]["time"],
        "lastTrueM1Time": rows[-1]["time"],
        "firstHourM1CheckOk": True,
        "firstHourExpectedRows": 60,
        "firstHourTrueRows": min(60, rows_count),
        "gapCount": 0,
        "m1IntegrityStatus": "true_m1_continuous",
    }
    measurements = []
    for label, elapsed, payload in [
        timed("append_m1", lambda: append_ohlcv_part_v5(rows, provider="mt5", symbol="BENCH", mode="direct", timeframe="M1", store_root=store_root, manifest_extra=extra)),
        timed("query_latest_m1", lambda: query_ohlcv_store_v5(symbol="BENCH", timeframe="M1", store_root=store_root, limit=1000)),
        timed("aggregate_m5_h1", lambda: aggregate_from_m1_store_v5(symbol="BENCH", target_timeframes=["M5", "H1"], store_root=store_root, rebuild=True)),
        timed("query_h1", lambda: query_ohlcv_store_v5(symbol="BENCH", timeframe="H1", mode="aggregated", base_timeframe="M1", anchor="UTC2200", store_root=store_root, limit=1000)),
    ]:
        measurements.append({
            "label": label,
            "seconds": round(elapsed, 4),
            "ok": payload.get("ok") is not False,
            "rowsCount": payload.get("rowsCount") or payload.get("rowsWritten"),
        })
    return {"rows": rows_count, "storeRoot": str(store_root), "measurements": measurements}


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark StoreV5 append/query/aggregate on generated data.")
    parser.add_argument("--rows", type=int, default=100_000)
    parser.add_argument("--store-root", type=Path, default=None)
    parser.add_argument("--history-root", type=Path, default=ROOT / "runtime_data" / "benchmarks")
    args = parser.parse_args()

    if args.store_root:
        args.store_root.mkdir(parents=True, exist_ok=True)
        report = run_benchmark(args.rows, args.store_root)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            report = run_benchmark(args.rows, Path(tmp))
    args.history_root.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    history_path = args.history_root / f"store_v5_benchmark_{args.rows}_{stamp}.json"
    history_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report["historyPath"] = str(history_path)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
