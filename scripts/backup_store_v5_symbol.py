from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from python.data_warehouse.store_v5.manifest_v5 import load_manifest_v5
from python.data_warehouse.store_v5.store_v5_paths import resolve_store_root


def main() -> int:
    parser = argparse.ArgumentParser(description="Backup StoreV5 datasets for one symbol.")
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--store-root", type=Path, default=None)
    parser.add_argument("--backup-root", type=Path, default=ROOT / "runtime_data" / "backups" / "store_v5")
    args = parser.parse_args()

    store_root = resolve_store_root(args.store_root)
    manifest = load_manifest_v5(store_root)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    target_root = args.backup_root / f"{args.symbol}_{stamp}"
    target_root.mkdir(parents=True, exist_ok=True)
    copied: list[str] = []

    for key, cell in manifest.get("datasets", {}).items():
        if cell.get("symbol") != args.symbol:
            continue
        rel_root = str(cell.get("rootPath") or "")
        source = (store_root / rel_root).resolve()
        if source.exists():
            destination = target_root / rel_root
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(source, destination)
            copied.append(key)

    report = {"ok": True, "symbol": args.symbol, "backupRoot": str(target_root), "datasets": copied}
    (target_root / "backup_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
