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


def main() -> int:
    parser = argparse.ArgumentParser(description="Report StoreV5 parquet partitions that are candidates for compaction.")
    parser.add_argument("--symbol", default=None)
    parser.add_argument("--store-root", type=Path, default=None)
    parser.add_argument("--min-parts", type=int, default=8)
    parser.add_argument("--apply", action="store_true", help="Reserved for future use; current implementation is dry-run only.")
    args = parser.parse_args()
    root = resolve_store_root(args.store_root)
    manifest = load_manifest_v5(root)
    candidates = []
    for key, cell in manifest.get("datasets", {}).items():
        if args.symbol and cell.get("symbol") != args.symbol:
            continue
        ds_root = root / str(cell.get("rootPath") or "")
        if not ds_root.exists():
            continue
        by_partition: dict[str, int] = {}
        for part in ds_root.rglob("part-*.parquet"):
            rel_parent = str(part.parent.relative_to(ds_root))
            by_partition[rel_parent] = by_partition.get(rel_parent, 0) + 1
        for partition, count in by_partition.items():
            if count >= args.min_parts:
                candidates.append({"datasetKey": key, "partition": partition, "parts": count})
    report = {"ok": True, "dryRun": True, "applyRequested": bool(args.apply), "candidates": candidates}
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
