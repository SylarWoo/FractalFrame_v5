from __future__ import annotations

import argparse
import json

from ..mt5.mt5_m1_pull_service_v1 import pull_mt5_m1_to_store_v5


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--mode", choices=["refresh", "incremental"], default="incremental")
    parser.add_argument("--count", type=int, default=500_000)
    parser.add_argument("--store-root")
    parser.add_argument("--overlap-bars", type=int, default=1000)
    args = parser.parse_args()
    report = pull_mt5_m1_to_store_v5(
        symbol=args.symbol,
        count=args.count,
        import_mode=args.mode,
        store_root=args.store_root,
        overlap_bars=args.overlap_bars,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
