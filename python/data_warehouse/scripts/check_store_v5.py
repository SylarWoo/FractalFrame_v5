from __future__ import annotations

import argparse
import json

from ..store_v5.manifest_v5 import load_manifest_v5
from ..store_v5.store_v5_paths import dataset_key


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--provider", default="mt5")
    parser.add_argument("--store-root")
    args = parser.parse_args()
    manifest = load_manifest_v5(args.store_root)
    direct_key = dataset_key(provider=args.provider, symbol=args.symbol, mode="direct", timeframe="M1")
    direct = manifest.get("datasets", {}).get(direct_key)
    aggregated = [
        cell
        for cell in manifest.get("datasets", {}).values()
        if cell.get("provider") == args.provider and cell.get("symbol") == args.symbol and cell.get("mode") == "aggregated"
    ]
    print(json.dumps({"directM1": direct, "aggregated": aggregated}, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
