from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from python.data_warehouse.store_v5.audit_store_v5 import audit_store_v5


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit StoreV5 manifest and parquet consistency.")
    parser.add_argument("--symbol", default=None)
    parser.add_argument("--store-root", type=Path, default=None)
    parser.add_argument("--repair", action="store_true")
    args = parser.parse_args()
    report = audit_store_v5(symbol=args.symbol, store_root=args.store_root, repair=args.repair)
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if report.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
