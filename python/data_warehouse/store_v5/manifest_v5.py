from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .store_v5_paths import SCHEMA_VERSION, STORE_VERSION, ensure_store_layout, manifest_path


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def empty_manifest() -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "storeVersion": STORE_VERSION,
        "updatedAt": utc_now_iso(),
        "datasets": {},
    }


def load_manifest_v5(store_root: str | Path | None = None) -> dict[str, Any]:
    ensure_store_layout(store_root)
    path = manifest_path(store_root)
    if not path.exists():
        manifest = empty_manifest()
        save_manifest_v5(manifest, store_root)
        return manifest
    with path.open("r", encoding="utf-8") as f:
        manifest = json.load(f)
    manifest.setdefault("schemaVersion", SCHEMA_VERSION)
    manifest.setdefault("storeVersion", STORE_VERSION)
    manifest.setdefault("datasets", {})
    return manifest


def save_manifest_v5(manifest: dict[str, Any], store_root: str | Path | None = None) -> Path:
    ensure_store_layout(store_root)
    path = manifest_path(store_root)
    manifest["updatedAt"] = utc_now_iso()
    tmp = path.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    tmp.replace(path)
    return path


def get_dataset_cell(store_root: str | Path | None, key: str) -> dict[str, Any] | None:
    return load_manifest_v5(store_root).get("datasets", {}).get(key)


def upsert_dataset_cell(store_root: str | Path | None, key: str, cell: dict[str, Any]) -> dict[str, Any]:
    manifest = load_manifest_v5(store_root)
    cell.setdefault("schemaVersion", SCHEMA_VERSION)
    manifest["datasets"][key] = cell
    save_manifest_v5(manifest, store_root)
    return cell


def delete_dataset_cell(store_root: str | Path | None, key: str) -> None:
    manifest = load_manifest_v5(store_root)
    if key in manifest.get("datasets", {}):
        del manifest["datasets"][key]
        save_manifest_v5(manifest, store_root)


def mark_aggregated_dirty_for_symbol(
    store_root: str | Path | None,
    *,
    provider: str,
    symbol: str,
) -> int:
    manifest = load_manifest_v5(store_root)
    changed = 0
    for cell in manifest.get("datasets", {}).values():
        if cell.get("provider") == provider and cell.get("symbol") == symbol and cell.get("mode") == "aggregated":
            if not cell.get("dirty"):
                changed += 1
            cell["dirty"] = True
    if changed:
        save_manifest_v5(manifest, store_root)
    return changed
