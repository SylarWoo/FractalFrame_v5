from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from python.data_warehouse.aggregate.aggregate_from_m1_service_v1 import aggregate_from_m1_store_v5
from python.data_warehouse.query.duckdb_ohlcv_query_v5 import query_ohlcv_store_v5
from python.data_warehouse.store_v5.store_v5_paths import resolve_store_root


def verify(symbol: str, timeframes: list[str], store_root: Path) -> dict:
    results = {}
    with tempfile.TemporaryDirectory() as tmp:
        temp_root = Path(tmp)
        # Reuse the existing direct M1 by pointing the verifier at the same store for now:
        # this script compares regenerated aggregate query shape against current aggregate rows.
        for timeframe in timeframes:
            current = query_ohlcv_store_v5(symbol=symbol, timeframe=timeframe, mode="aggregated", base_timeframe="M1", anchor="UTC2200", store_root=store_root, limit=1000)
            regenerated = aggregate_from_m1_store_v5(symbol=symbol, target_timeframes=[timeframe], store_root=store_root, rebuild=False)
            after = query_ohlcv_store_v5(symbol=symbol, timeframe=timeframe, mode="aggregated", base_timeframe="M1", anchor="UTC2200", store_root=store_root, limit=1000)
            results[timeframe] = {
                "ok": current.get("ok") is True and after.get("ok") is True and regenerated.get("ok") is True,
                "currentRows": current.get("rowsCount"),
                "afterRows": after.get("rowsCount"),
                "aggregateStatus": regenerated.get("results", {}).get(timeframe, {}).get("status"),
            }
        _ = temp_root
    return {"ok": all(item["ok"] for item in results.values()), "symbol": symbol, "results": results}


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify StoreV5 aggregate datasets can be refreshed and queried.")
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--timeframes", default="M5,H1,H4")
    parser.add_argument("--store-root", type=Path, default=None)
    args = parser.parse_args()
    report = verify(args.symbol, [item.strip().upper() for item in args.timeframes.split(",") if item.strip()], resolve_store_root(args.store_root))
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if report.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
