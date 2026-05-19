from __future__ import annotations

import argparse
import json

from ..aggregate.aggregate_from_m1_service_v1 import aggregate_from_m1_store_v5


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--timeframes", default="M5,M15,M30,H1,H2,H3,H4,D1,W1,MN1")
    parser.add_argument("--store-root")
    parser.add_argument("--anchor", default="UTC2200")
    parser.add_argument("--rebuild", action="store_true")
    args = parser.parse_args()
    report = aggregate_from_m1_store_v5(
        symbol=args.symbol,
        target_timeframes=[value.strip() for value in args.timeframes.split(",") if value.strip()],
        store_root=args.store_root,
        anchor=args.anchor,
        rebuild=args.rebuild,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
