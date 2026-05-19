from __future__ import annotations

import argparse
import json

from ..mt5.mt5_m1_clean_service_v1 import clean_raw_m1_to_direct_store_v5


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--store-root")
    args = parser.parse_args()
    report = clean_raw_m1_to_direct_store_v5(symbol=args.symbol, store_root=args.store_root, rebuild=True)
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
