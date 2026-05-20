from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from python.data_warehouse.store_v5.manifest_v5 import load_manifest_v5
from python.data_warehouse.store_v5.store_v5_paths import resolve_store_root


def dir_size(path: Path) -> int:
    return sum(file.stat().st_size for file in path.rglob("*") if file.is_file())


def main() -> int:
    parser = argparse.ArgumentParser(description="Report StoreV5 disk usage by dataset and symbol.")
    parser.add_argument("--symbol", default=None)
    parser.add_argument("--store-root", type=Path, default=None)
    args = parser.parse_args()
    root = resolve_store_root(args.store_root)
    manifest = load_manifest_v5(root)
    datasets = []
    by_symbol: dict[str, int] = {}
    for key, cell in manifest.get("datasets", {}).items():
        symbol = str(cell.get("symbol") or "")
        if args.symbol and symbol != args.symbol:
            continue
        path = root / str(cell.get("rootPath") or "")
        size = dir_size(path) if path.exists() else 0
        by_symbol[symbol] = by_symbol.get(symbol, 0) + size
        datasets.append({"datasetKey": key, "symbol": symbol, "bytes": size, "rootPath": cell.get("rootPath")})
    report = {"ok": True, "storeRoot": str(root), "symbols": by_symbol, "datasets": sorted(datasets, key=lambda item: item["bytes"], reverse=True)}
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
