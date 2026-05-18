from __future__ import annotations

import argparse
import json

from ..query.duckdb_ohlcv_query_v5 import query_ohlcv_store_v5


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--timeframe", required=True)
    parser.add_argument("--mode", choices=["direct", "aggregated"], default="direct")
    parser.add_argument("--provider", default="mt5")
    parser.add_argument("--base-timeframe")
    parser.add_argument("--anchor")
    parser.add_argument("--time-from", type=int)
    parser.add_argument("--time-to", type=int)
    parser.add_argument("--limit", type=int, default=5000)
    parser.add_argument("--store-root")
    args = parser.parse_args()
    report = query_ohlcv_store_v5(
        symbol=args.symbol,
        timeframe=args.timeframe,
        provider=args.provider,
        mode=args.mode,
        base_timeframe=args.base_timeframe,
        anchor=args.anchor,
        time_from=args.time_from,
        time_to=args.time_to,
        limit=args.limit,
        store_root=args.store_root,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True, default=str))


if __name__ == "__main__":
    main()
