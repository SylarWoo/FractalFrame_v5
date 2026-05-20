from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from python.data_warehouse.aggregate.aggregate_from_m1_service_v1 import _aggregate, _read_direct_m1
from python.data_warehouse.query.duckdb_ohlcv_query_v5 import query_ohlcv_store_v5
from python.data_warehouse.store_v5.store_v5_paths import resolve_store_root


def _round_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "time": int(row["time"]),
        "open": round(float(row["open"]), 10),
        "high": round(float(row["high"]), 10),
        "low": round(float(row["low"]), 10),
        "close": round(float(row["close"]), 10),
        "volume": int(float(row.get("volume") or 0)),
    }


def verify(symbol: str, timeframes: list[str], store_root: Path, *, time_from: int | None, limit: int) -> dict[str, Any]:
    results: dict[str, Any] = {}
    direct_df = _read_direct_m1(store_root, symbol, time_from=time_from)
    if direct_df.empty:
        return {"ok": False, "symbol": symbol, "error": "direct_m1_empty", "results": {}}

    for timeframe in timeframes:
        expected_df = _aggregate(direct_df, timeframe, "UTC2200").head(limit)
        expected_rows = [_round_row(row) for row in expected_df.to_dict("records")]
        if not expected_rows:
            results[timeframe] = {"ok": False, "error": "no_expected_rows"}
            continue
        current = query_store_rows(symbol, timeframe, store_root, expected_rows[0]["time"], expected_rows[-1]["time"], limit)
        actual_rows = [_round_row(row) for row in current.get("rows", [])]
        mismatch = None
        for index, expected in enumerate(expected_rows):
            actual = actual_rows[index] if index < len(actual_rows) else None
            if actual != expected:
                mismatch = {"index": index, "expected": expected, "actual": actual}
                break
        results[timeframe] = {
            "ok": mismatch is None and len(actual_rows) == len(expected_rows),
            "expectedRows": len(expected_rows),
            "actualRows": len(actual_rows),
            "firstMismatch": mismatch,
        }
    return {"ok": all(item.get("ok") for item in results.values()), "symbol": symbol, "results": results}


def query_store_rows(symbol: str, timeframe: str, store_root: Path, time_from: int, time_to: int, limit: int) -> dict[str, Any]:
    return query_ohlcv_store_v5(
        symbol=symbol,
        timeframe=timeframe,
        mode="aggregated",
        base_timeframe="M1",
        anchor="UTC2200",
        store_root=store_root,
        time_from=time_from,
        time_to=time_to,
        limit=limit,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Strictly verify StoreV5 aggregate OHLCV rows by recomputing them from direct M1.")
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--timeframes", default="M5,H1,H4")
    parser.add_argument("--store-root", type=Path, default=None)
    parser.add_argument("--time-from", type=int, default=None)
    parser.add_argument("--limit", type=int, default=1000)
    args = parser.parse_args()
    report = verify(
        args.symbol,
        [item.strip().upper() for item in args.timeframes.split(",") if item.strip()],
        resolve_store_root(args.store_root),
        time_from=args.time_from,
        limit=args.limit,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if report.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
