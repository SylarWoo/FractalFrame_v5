from __future__ import annotations

import json
import threading
import uuid
from pathlib import Path
from typing import Any, Callable

_LOCK = threading.RLock()


def diagnostics_dir(store_root: Path | None) -> Path:
    from python.data_warehouse.store_v6.paths_v6 import ensure_store_layout

    root = ensure_store_layout(store_root)
    path = root / "diagnostics"
    path.mkdir(parents=True, exist_ok=True)
    return path


def ledger_path(store_root: Path | None) -> Path:
    return diagnostics_dir(store_root) / "daily_maintenance_ledger.json"


def events_path(store_root: Path | None) -> Path:
    return diagnostics_dir(store_root) / "daily_maintenance_events.jsonl"


def read_json(path: Path, fallback: Any) -> Any:
    try:
        if not path.exists():
            return fallback
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def write_json_atomic(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(f"{path.suffix}.tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(path)


def record_key(date: str, symbol: str) -> str:
    return f"{date}:{symbol.strip()}"


def read_ledger(store_root: Path | None) -> dict[str, Any]:
    payload = read_json(ledger_path(store_root), {"records": {}})
    if not isinstance(payload, dict):
        return {"records": {}}
    records = payload.get("records")
    if not isinstance(records, dict):
        payload["records"] = {}
    return payload


def append_event(store_root: Path | None, event: dict[str, Any], *, utc_now_iso: Callable[[], str]) -> dict[str, Any]:
    item = {
        "eventId": uuid.uuid4().hex,
        "createdAt": utc_now_iso(),
        **event,
    }
    path = events_path(store_root)
    path.parent.mkdir(parents=True, exist_ok=True)
    with _LOCK:
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(item, ensure_ascii=False, separators=(",", ":")) + "\n")
    return item


def update_ledger(store_root: Path | None, date: str, symbol: str, updates: dict[str, Any], *, utc_now_iso: Callable[[], str]) -> dict[str, Any]:
    with _LOCK:
        ledger = read_ledger(store_root)
        records = ledger.setdefault("records", {})
        key = record_key(date, symbol)
        current = records.get(key)
        if not isinstance(current, dict):
            current = {"date": date, "symbol": symbol}
        current.update(updates)
        current["updatedAt"] = utc_now_iso()
        records[key] = current
        ledger["updatedAt"] = utc_now_iso()
        write_json_atomic(ledger_path(store_root), ledger)
        return dict(current)


def get_record(store_root: Path | None, date: str, symbol: str) -> dict[str, Any] | None:
    ledger = read_ledger(store_root)
    record = ledger.get("records", {}).get(record_key(date, symbol))
    return dict(record) if isinstance(record, dict) else None


def read_events(symbol: str | None = None, *, store_root: Path | None = None, limit: int = 200) -> list[dict[str, Any]]:
    path = events_path(store_root)
    rows: list[dict[str, Any]] = []
    try:
        lines = path.read_text(encoding="utf-8").splitlines()[-max(1, min(limit, 1000)):]
    except FileNotFoundError:
        lines = []
    for line in lines:
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        if symbol and item.get("symbol") != symbol:
            continue
        rows.append(item)
    return rows
