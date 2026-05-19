from __future__ import annotations

import argparse
import json
import shutil
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
DEFAULT_CACHE_ROOT = ROOT / "runtime_data" / "instruments" / "mt5"
SYMBOL_CACHE_FILE = "symbol_universe_info.json"
SYMBOL_REPORT_FILE = "symbol_universe_scan_report.json"
M1_CHECK_JOBS: dict[str, dict[str, Any]] = {}
M1_CHECK_JOBS_LOCK = threading.Lock()
PULL_JOBS: dict[str, dict[str, Any]] = {}
PULL_JOBS_LOCK = threading.Lock()
PULL_JOBS_CONDITION = threading.Condition(PULL_JOBS_LOCK)
PULL_JOB_TERMINAL_PHASES = {"completed", "failed", "cancelled"}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clamp_limit(value: str | None, default: int = 50_000) -> int:
    try:
        parsed = int(value or default)
    except ValueError:
        parsed = default
    return max(1, min(parsed, 50_000))


def clamp_m1_check_count(value: str | None, default: int = 200_000) -> int:
    try:
        parsed = int(value or default)
    except ValueError:
        parsed = default
    return max(1, min(parsed, 10_000_000))


def clamp_m1_check_chunk(value: str | None, default: int = 200_000) -> int:
    try:
        parsed = int(value or default)
    except ValueError:
        parsed = default
    return max(1_000, min(parsed, 500_000))


def safe_bool(value: Any, default: bool | None = None) -> bool | None:
    if value is None:
        return default
    return bool(value)


def safe_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def safe_query_int(value: str | None, default: int | None = None) -> int | None:
    if value is None or value == "":
        return default
    try:
        return int(value)
    except ValueError:
        return default


def query_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "y", "on"}


def namedtuple_to_dict(value: Any) -> dict[str, Any]:
    if hasattr(value, "_asdict"):
        raw = value._asdict()
        return raw if isinstance(raw, dict) else {}
    if isinstance(value, dict):
        return value
    return {}


def derive_market(path: str, category: str) -> tuple[str, str]:
    path_lower = path.replace("/", "\\").lower()
    category_lower = category.lower()
    hint = category or "UNKNOWN"

    if "metal" in category_lower or "metal" in path_lower:
        return "forex_metal", hint
    if "crypto" in category_lower or "crypto" in path_lower or "bitcoin" in path_lower:
        return "crypto", hint
    if "forex" in category_lower or "major" in category_lower or "minor" in category_lower:
        return "forex", hint
    if "index" in category_lower or "indices" in category_lower or "index" in path_lower:
        return "indices", hint
    if "stock" in category_lower or "stock" in path_lower or "share" in path_lower:
        return "stocks", hint
    if "energy" in category_lower or "oil" in path_lower or "gas" in path_lower:
        return "energy", hint
    return "unknown", hint


def symbol_row(info: Any, scanned_at: str) -> dict[str, Any]:
    raw = namedtuple_to_dict(info)

    def get(key: str) -> Any:
        return getattr(info, key, raw.get(key, None))

    symbol = str(get("name") or "").strip()
    description = str(get("description") or symbol).strip()
    path = str(get("path") or "").strip()
    category = str(get("category") or "").strip()
    market, source = derive_market(path, category)

    return {
        "symbol": symbol,
        "name": description or symbol,
        "description": description or symbol,
        "path": path,
        "category": category,
        "source": source,
        "market": market,
        "visible": safe_bool(get("visible"), default=True),
        "select": safe_bool(get("select"), default=None),
        "custom": safe_bool(get("custom"), default=None),
        "digits": safe_int(get("digits")),
        "point": safe_float(get("point")),
        "spread": safe_int(get("spread")),
        "spreadFloat": safe_bool(get("spread_float"), default=None),
        "currencyBase": str(get("currency_base") or ""),
        "currencyProfit": str(get("currency_profit") or ""),
        "currencyMargin": str(get("currency_margin") or ""),
        "tradeMode": safe_int(get("trade_mode")),
        "tradeCalcMode": safe_int(get("trade_calc_mode")),
        "tradeContractSize": safe_float(get("trade_contract_size")),
        "volumeMin": safe_float(get("volume_min")),
        "volumeMax": safe_float(get("volume_max")),
        "volumeStep": safe_float(get("volume_step")),
        "tradeTickSize": safe_float(get("trade_tick_size")),
        "tradeTickValue": safe_float(get("trade_tick_value")),
        "tradeStopsLevel": safe_int(get("trade_stops_level")),
        "seenAt": scanned_at,
        "lastSeenAt": scanned_at,
        "missingFromLatestScan": False,
    }


def read_json(path: Path) -> dict[str, Any] | None:
    try:
        if not path.is_file():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    tmp.replace(path)


def filter_symbols(symbols: list[dict[str, Any]], query: str, market: str, limit: int) -> list[dict[str, Any]]:
    q = query.strip().lower()
    market_key = market.strip().lower()
    rows: list[dict[str, Any]] = []

    for row in symbols:
        symbol = str(row.get("symbol") or "")
        if not symbol:
            continue
        if market_key and str(row.get("market") or "").lower() != market_key:
            continue
        if q:
            haystack = " ".join(
                str(row.get(key) or "")
                for key in ("symbol", "name", "description", "path", "category", "currencyBase", "currencyProfit")
            ).lower()
            if q not in haystack:
                continue
        rows.append(row)
        if len(rows) >= limit:
            break

    return rows


def scan_mt5_symbols(cache_root: Path, query: str, market: str, limit: int) -> dict[str, Any]:
    published_at = utc_now_iso()
    base_fail = {
        "ok": False,
        "status": "mt5_symbol_universe_failed_v1",
        "provider": "mt5",
        "count": 0,
        "symbols": [],
        "publishedAt": published_at,
    }

    try:
        import MetaTrader5 as mt5
    except ImportError as exc:
        return {**base_fail, "status": "mt5_symbol_universe_unavailable_v1", "error": str(exc)}

    initialized = False
    try:
        if not mt5.initialize():
            return {
                **base_fail,
                "status": "mt5_symbol_universe_init_failed_v1",
                "error": "mt5_initialize_failed",
                "mt5LastError": mt5.last_error(),
            }
        initialized = True

        raw_symbols = mt5.symbols_get()
        if raw_symbols is None:
            return {
                **base_fail,
                "status": "mt5_symbols_get_failed_v1",
                "error": "symbols_get_returned_none",
                "mt5LastError": mt5.last_error(),
            }

        all_rows = [symbol_row(item, published_at) for item in raw_symbols]
        all_rows = [row for row in all_rows if row.get("symbol")]
        all_rows.sort(key=lambda item: str(item.get("symbol", "")).lower())

        previous = read_json(cache_root / SYMBOL_CACHE_FILE)
        previous_symbols = previous.get("symbols") if isinstance(previous, dict) and isinstance(previous.get("symbols"), list) else []
        previous_by_symbol = {str(row.get("symbol") or ""): row for row in previous_symbols if isinstance(row, dict)}
        previous_keys = set(previous_by_symbol)
        scanned_keys = {str(row.get("symbol") or "") for row in all_rows}

        added = len(scanned_keys - previous_keys)
        updated = len(scanned_keys & previous_keys)
        report = {
            "ok": True,
            "status": "mt5_symbol_universe_incremental_scan_completed_v1",
            "added": added,
            "updated": updated,
            "unchanged": 0,
            "missingFromLatestScan": len(previous_keys - scanned_keys),
            "previousCount": len(previous_symbols),
            "scannedCount": len(all_rows),
            "total": len(all_rows),
            "scannedAt": published_at,
        }

        cache_payload = {
            "ok": True,
            "status": "mt5_symbol_universe_cache_ready_v1",
            "provider": "mt5",
            "count": len(all_rows),
            "symbols": all_rows,
            "updatedAt": published_at,
            "lastScanReport": report,
        }
        write_json(cache_root / SYMBOL_CACHE_FILE, cache_payload)
        write_json(cache_root / SYMBOL_REPORT_FILE, report)

        rows = filter_symbols(all_rows, query=query, market=market, limit=limit)
        return {
            "ok": True,
            "status": "mt5_symbol_universe_incremental_cache_ready_v1",
            "provider": "mt5",
            "count": len(rows),
            "totalCount": len(all_rows),
            "symbols": rows,
            "scanReport": report,
            "cache": {
                "ready": True,
                "path": str(cache_root / SYMBOL_CACHE_FILE),
                "reportPath": str(cache_root / SYMBOL_REPORT_FILE),
                "updatedAt": published_at,
            },
            "publishedAt": utc_now_iso(),
            "updatedAt": published_at,
        }
    except Exception as exc:
        return {**base_fail, "status": "mt5_symbol_universe_exception_v1", "error": str(exc)}
    finally:
        if initialized:
            try:
                mt5.shutdown()
            except Exception:
                pass


def read_symbol_cache(cache_root: Path, query: str, market: str, limit: int) -> dict[str, Any]:
    published_at = utc_now_iso()
    cache_path = cache_root / SYMBOL_CACHE_FILE
    payload = read_json(cache_path)
    if not payload:
        return {
            "ok": True,
            "status": "mt5_symbol_universe_cache_empty_v1",
            "provider": "mt5",
            "count": 0,
            "totalCount": 0,
            "symbols": [],
            "cache": {"ready": False, "path": str(cache_path)},
            "publishedAt": published_at,
            "updatedAt": None,
        }

    all_symbols = payload.get("symbols") if isinstance(payload.get("symbols"), list) else []
    rows = filter_symbols(all_symbols, query=query, market=market, limit=limit)
    return {
        "ok": True,
        "status": "mt5_symbol_universe_cache_ready_v1",
        "provider": "mt5",
        "count": len(rows),
        "totalCount": len(all_symbols),
        "symbols": rows,
        "cache": {
            "ready": True,
            "path": str(cache_path),
            "updatedAt": payload.get("updatedAt"),
            "lastScanReport": payload.get("lastScanReport"),
        },
        "publishedAt": published_at,
        "updatedAt": payload.get("updatedAt"),
    }


def format_utc_text(value: Any) -> str | None:
    if value is None:
        return None
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    except (TypeError, ValueError, OSError):
        return None


def check_store_v5(symbol: str, store_root: Path | None = None) -> dict[str, Any]:
    from python.data_warehouse.store_v5.manifest_v5 import load_manifest_v5
    from python.data_warehouse.store_v5.store_v5_paths import dataset_key, resolve_store_root

    root = resolve_store_root(store_root)
    raw_key = dataset_key(provider="mt5", symbol=symbol, mode="raw_direct", timeframe="M1")
    direct_key = dataset_key(provider="mt5", symbol=symbol, mode="direct", timeframe="M1")
    manifest = load_manifest_v5(root)
    raw_direct = manifest.get("datasets", {}).get(raw_key)
    direct = manifest.get("datasets", {}).get(direct_key)
    aggregated = [
        cell
        for cell in manifest.get("datasets", {}).values()
        if cell.get("provider") == "mt5" and cell.get("symbol") == symbol and cell.get("mode") == "aggregated"
    ]
    aggregated.sort(key=lambda cell: str(cell.get("timeframe") or ""))

    if not direct:
        return {
            "ok": True,
            "status": "store_v5_direct_m1_missing" if not raw_direct else "store_v5_raw_m1_ready_clean_pending",
            "provider": "store_v5",
            "storeVersion": "v5",
            "symbol": symbol,
            "rawDirectM1": {
                "datasetKey": raw_key,
                "mt5RowsCount": raw_direct.get("mt5RowsCount"),
                "rawRowsCount": raw_direct.get("rawRowsCount"),
                "rowsCount": raw_direct.get("rowsCount"),
                "firstTime": raw_direct.get("firstTime"),
                "lastTime": raw_direct.get("lastTime"),
                "firstTimeText": format_utc_text(raw_direct.get("firstTime")),
                "lastTimeText": format_utc_text(raw_direct.get("lastTime")),
                "cleanStatus": raw_direct.get("cleanStatus"),
                "lastImportAt": raw_direct.get("lastImportAt"),
                "status": raw_direct.get("status"),
                "rootPath": raw_direct.get("rootPath"),
            } if raw_direct else None,
            "directM1": {
                "datasetKey": raw_key,
                "mt5RowsCount": raw_direct.get("mt5RowsCount"),
                "trueM1RowsCount": raw_direct.get("rowsCount") or raw_direct.get("rawRowsCount"),
                "rowsCount": raw_direct.get("rowsCount") or raw_direct.get("rawRowsCount"),
                "firstTime": raw_direct.get("firstTime"),
                "lastTime": raw_direct.get("lastTime"),
                "firstTimeText": format_utc_text(raw_direct.get("firstTime")),
                "lastTimeText": format_utc_text(raw_direct.get("lastTime")),
                "lastImportAt": raw_direct.get("lastImportAt"),
                "status": "raw_m1_ready_clean_pending",
                "rootPath": raw_direct.get("rootPath"),
            } if raw_direct else None,
            "aggregated": aggregated,
            "publishedAt": utc_now_iso(),
        }

    raw_rows_count = safe_int(raw_direct.get("rowsCount")) if raw_direct else None
    raw_last_time = safe_int(raw_direct.get("lastTime")) if raw_direct else None
    direct_rows_count = safe_int(direct.get("rowsCount"))
    direct_last_time = safe_int(direct.get("lastTrueM1Time") or direct.get("lastTime"))
    direct_summary_rows_count = direct.get("rowsCount")
    direct_summary_last_import_at = direct.get("lastImportAt")
    if (
        raw_rows_count is not None
        and raw_rows_count > 0
        and direct_rows_count is not None
        and direct_rows_count > 0
        and raw_rows_count > direct_rows_count * 10
        and (raw_last_time is None or direct_last_time is None or raw_last_time > direct_last_time)
    ):
        direct_summary_rows_count = raw_rows_count
        direct_summary_last_import_at = raw_direct.get("lastImportAt") if raw_direct else direct.get("lastImportAt")

    first_time = direct.get("firstTime") or direct.get("firstAnchorTime")
    last_time = direct.get("lastTrueM1Time") or direct.get("lastTime")
    return {
        "ok": True,
        "status": "store_v5_check_ready",
        "provider": "store_v5",
        "storeVersion": "v5",
        "symbol": symbol,
        "rawDirectM1": {
            "datasetKey": raw_key,
            "mt5RowsCount": raw_direct.get("mt5RowsCount") if raw_direct else None,
            "rawRowsCount": raw_direct.get("rawRowsCount") if raw_direct else None,
            "rowsCount": raw_direct.get("rowsCount") if raw_direct else None,
            "firstTime": raw_direct.get("firstTime") if raw_direct else None,
            "lastTime": raw_direct.get("lastTime") if raw_direct else None,
            "firstTimeText": format_utc_text(raw_direct.get("firstTime")) if raw_direct else None,
            "lastTimeText": format_utc_text(raw_direct.get("lastTime")) if raw_direct else None,
            "cleanStatus": raw_direct.get("cleanStatus") if raw_direct else None,
            "lastImportAt": raw_direct.get("lastImportAt") if raw_direct else None,
            "status": raw_direct.get("status") if raw_direct else None,
            "rootPath": raw_direct.get("rootPath") if raw_direct else None,
        } if raw_direct else None,
        "directM1": {
            "datasetKey": direct_key,
            "mt5RowsCount": direct.get("mt5RowsCount"),
            "trueM1RowsCount": direct.get("trueM1RowsCount"),
            "rowsCount": direct_summary_rows_count,
            "firstTime": first_time,
            "lastTime": last_time,
            "firstTimeText": format_utc_text(first_time),
            "lastTimeText": format_utc_text(last_time),
            "firstAnchorTime": direct.get("firstAnchorTime"),
            "firstHourM1CheckOk": direct.get("firstHourM1CheckOk"),
            "firstHourTrueRows": direct.get("firstHourTrueRows"),
            "gapCount": direct.get("gapCount"),
            "m1IntegrityStatus": direct.get("m1IntegrityStatus"),
            "lastImportAt": direct_summary_last_import_at,
            "status": direct.get("status"),
            "rootPath": direct.get("rootPath"),
        },
        "aggregated": aggregated,
        "publishedAt": utc_now_iso(),
    }


def delete_store_v5_symbol(symbol: str, store_root: Path | None = None) -> dict[str, Any]:
    from python.data_warehouse.store_v5.manifest_v5 import load_manifest_v5, save_manifest_v5
    from python.data_warehouse.store_v5.store_v5_paths import resolve_store_root

    root = resolve_store_root(store_root)
    datasets_root = (root / "datasets").resolve()
    manifest = load_manifest_v5(root)
    datasets = manifest.get("datasets", {})
    keys_to_delete = [
        key
        for key, cell in datasets.items()
        if cell.get("provider") == "mt5" and cell.get("symbol") == symbol
    ]

    deleted_dirs: list[str] = []
    for key in keys_to_delete:
        cell = datasets.get(key, {})
        rel_root = str(cell.get("rootPath") or "").strip()
        if rel_root:
            target = (root / rel_root).resolve()
            if target == datasets_root or datasets_root not in target.parents:
                return {
                    "ok": False,
                    "status": "store_v5_delete_refused",
                    "error": "dataset_path_outside_store",
                    "symbol": symbol,
                    "path": str(target),
                }
            if target.exists():
                shutil.rmtree(target)
                deleted_dirs.append(str(target))
        datasets.pop(key, None)

    if keys_to_delete:
        save_manifest_v5(manifest, root)

    return {
        "ok": True,
        "status": "store_v5_symbol_deleted" if keys_to_delete else "store_v5_symbol_not_found",
        "symbol": symbol,
        "deletedDatasets": keys_to_delete,
        "deletedDirs": deleted_dirs,
        "publishedAt": utc_now_iso(),
    }


def mt5_rates_to_rows(rates: Any) -> list[dict[str, Any]]:
    if rates is None:
        return []
    rows: list[dict[str, Any]] = []
    for row in rates:
        if hasattr(row, "_asdict"):
            rows.append(dict(row._asdict()))
            continue
        if isinstance(row, dict):
            rows.append(dict(row))
            continue
        names = getattr(getattr(row, "dtype", None), "names", None)
        if names:
            rows.append({name: row[name].item() if hasattr(row[name], "item") else row[name] for name in names})
            continue
        rows.append(dict(row))
    return rows


def mt5_row_to_m1_check_row(row: dict[str, Any], symbol: str, ingested_at: str) -> dict[str, Any]:
    return {
        "time": int(row["time"]),
        "open": float(row["open"]),
        "high": float(row["high"]),
        "low": float(row["low"]),
        "close": float(row["close"]),
        "volume": int(row.get("tick_volume", row.get("volume", 0)) or 0),
        "provider": "mt5",
        "symbol": symbol,
        "timeframe": "M1",
        "source": "mt5_terminal",
        "ingestedAt": ingested_at,
    }


def _set_m1_check_job(job_id: str, **updates: Any) -> dict[str, Any]:
    with M1_CHECK_JOBS_LOCK:
        job = M1_CHECK_JOBS.get(job_id)
        if not job:
            return {}
        job.update(updates)
        job["updatedAt"] = utc_now_iso()
        return dict(job)


def _get_m1_check_job(job_id: str) -> dict[str, Any] | None:
    with M1_CHECK_JOBS_LOCK:
        job = M1_CHECK_JOBS.get(job_id)
        return dict(job) if job else None


def _set_pull_job(job_id: str, **updates: Any) -> dict[str, Any]:
    with PULL_JOBS_CONDITION:
        job = PULL_JOBS.get(job_id)
        if not job:
            return {}
        job.update(updates)
        job["updatedAt"] = utc_now_iso()
        events = job.setdefault("events", [])
        event_id = int(job.get("lastEventId") or 0) + 1
        job["lastEventId"] = event_id
        phase = str(job.get("phase") or "")
        event_name = "progress"
        if phase == "completed":
            event_name = "done"
        elif phase == "failed":
            event_name = "error"
        elif phase == "cancelled":
            event_name = "cancelled"
        snapshot = _public_pull_job_snapshot(job)
        events.append({"id": event_id, "event": event_name, "data": snapshot})
        if len(events) > 500:
            del events[:-500]
        PULL_JOBS_CONDITION.notify_all()
        return snapshot


def _get_pull_job(job_id: str) -> dict[str, Any] | None:
    with PULL_JOBS_LOCK:
        job = PULL_JOBS.get(job_id)
        return _public_pull_job_snapshot(job) if job else None


def _public_pull_job_snapshot(job: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in job.items() if key != "events"}


def _build_m1_check_payload(
    *,
    symbol: str,
    raw_rows: list[dict[str, Any]],
    validation: dict[str, Any],
    published_at: str,
    staged: dict[str, Any] | None = None,
) -> dict[str, Any]:
    true_rows = validation.get("trueRows") or []
    first_time = validation.get("firstAnchorTime")
    last_time = validation.get("lastTrueM1Time")
    if true_rows:
        first_time = int(true_rows[0]["time"])
        last_time = int(true_rows[-1]["time"])

    return {
        "ok": True,
        "status": "mt5_m1_check_completed" if validation.get("ok") else "mt5_m1_check_failed_validation",
        "provider": "mt5",
        "storeVersion": "v5",
        "symbol": symbol,
        "directM1": {
            "datasetKey": f"mt5:{symbol}:direct:M1",
            "mt5RowsCount": validation.get("mt5RowsCount", len(raw_rows)),
            "trueM1RowsCount": validation.get("trueM1RowsCount", 0),
            "rowsCount": validation.get("trueM1RowsCount", 0),
            "firstTime": first_time,
            "lastTime": last_time,
            "firstTimeText": format_utc_text(first_time),
            "lastTimeText": format_utc_text(last_time),
            "firstAnchorTime": validation.get("firstAnchorTime"),
            "firstHourM1CheckOk": validation.get("firstHourM1CheckOk"),
            "firstHourTrueRows": validation.get("firstHourTrueRows"),
            "gapCount": validation.get("gapCount"),
            "m1IntegrityStatus": validation.get("m1IntegrityStatus"),
            "status": "mt5_live_check",
            "validationOk": validation.get("ok"),
            "validationError": validation.get("error"),
            "firstGap": validation.get("firstGap"),
        },
        "validation": {key: value for key, value in validation.items() if key != "trueRows"},
        "aggregated": [],
        "staged": staged,
        "publishedAt": published_at,
    }


def _build_incremental_m1_check_payload(
    *,
    symbol: str,
    raw_rows: list[dict[str, Any]],
    validation: dict[str, Any],
    published_at: str,
    base: dict[str, Any],
    staged: dict[str, Any] | None = None,
) -> dict[str, Any]:
    base_first_time = base.get("firstTime")
    base_last_time = int(base["lastTime"])
    base_true_count = int(base.get("trueM1RowsCount") or base.get("rowsCount") or 0)
    base_mt5_count = int(base.get("mt5RowsCount") or base_true_count)
    added_true_count = int(validation.get("trueM1RowsCount") or 0) if validation.get("ok") else 0
    last_time = int(validation.get("lastNewTime") or base_last_time)
    true_count = base_true_count + added_true_count
    mt5_count = base_mt5_count + added_true_count
    return {
        "ok": validation.get("ok") is True,
        "status": "mt5_m1_incremental_check_completed" if validation.get("ok") else "mt5_m1_incremental_check_failed_validation",
        "provider": "mt5",
        "storeVersion": "v5",
        "symbol": symbol,
        "directM1": {
            "datasetKey": f"mt5:{symbol}:direct:M1",
            "mt5RowsCount": mt5_count,
            "trueM1RowsCount": true_count,
            "rowsCount": true_count,
            "firstTime": base_first_time,
            "lastTime": last_time,
            "firstTimeText": format_utc_text(base_first_time),
            "lastTimeText": format_utc_text(last_time),
            "firstAnchorTime": base.get("firstAnchorTime") or base_first_time,
            "firstHourM1CheckOk": base.get("firstHourM1CheckOk"),
            "firstHourTrueRows": base.get("firstHourTrueRows"),
            "gapCount": base.get("gapCount"),
            "m1IntegrityStatus": validation.get("status") or "incremental_true_m1_ok",
            "status": "mt5_live_incremental_check",
            "validationOk": validation.get("ok"),
            "validationError": validation.get("error"),
            "firstGap": validation.get("firstGap"),
        },
        "validation": {key: value for key, value in validation.items() if key != "trueRows"},
        "aggregated": [],
        "staged": staged,
        "publishedAt": published_at,
    }


def run_mt5_m1_staged_check_job(
    job_id: str,
    symbol: str,
    *,
    chunk: int,
    max_count: int,
    pause_ms: int,
    mode: str = "refresh",
    since_time: int | None = None,
    base_first_time: int | None = None,
    base_last_time: int | None = None,
    base_true_m1_rows_count: int = 0,
    base_mt5_rows_count: int = 0,
    overlap_bars: int = 1000,
) -> None:
    from python.data_warehouse.mt5.mt5_m1_integrity_validator_v1 import validate_incremental_true_m1_rows_v1, validate_true_m1_rows_v1

    published_at = utc_now_iso()
    raw_rows: list[dict[str, Any]] = []
    initialized = False
    try:
        import MetaTrader5 as mt5

        if not mt5.initialize():
            _set_m1_check_job(
                job_id,
                ok=False,
                phase="failed",
                status="mt5_m1_check_init_failed",
                error="mt5_initialize_failed",
                mt5LastError=mt5.last_error(),
                finishedAt=utc_now_iso(),
            )
            return
        initialized = True

        if not mt5.symbol_select(symbol, True):
            _set_m1_check_job(
                job_id,
                ok=False,
                phase="failed",
                status="mt5_m1_check_symbol_select_failed",
                error="mt5_symbol_select_failed",
                mt5LastError=mt5.last_error(),
                finishedAt=utc_now_iso(),
            )
            return

        if mode == "incremental" and since_time is not None:
            from datetime import timedelta

            from_time = datetime.fromtimestamp(int(since_time) - max(0, int(overlap_bars)) * 60, tz=timezone.utc)
            to_time = datetime.now(timezone.utc) + timedelta(minutes=1)
            _set_m1_check_job(
                job_id,
                ok=True,
                phase="fetching",
                status="mt5_m1_incremental_check_fetching",
                currentAction="copy_rates_range",
                chunkSize=chunk,
                maxCount=None,
                firstTimeText=format_utc_text(int(from_time.timestamp())),
                lastTimeText=format_utc_text(int(to_time.timestamp())),
            )
            rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_M1, from_time, to_time)
            raw_rows = mt5_rates_to_rows(rates)
            _set_m1_check_job(job_id, phase="validating", status="mt5_m1_incremental_check_validating", mt5RowsCount=len(raw_rows))
            canonical_rows = [
                mt5_row_to_m1_check_row(row, symbol=symbol, ingested_at=published_at)
                for row in raw_rows
            ]
            validation = validate_incremental_true_m1_rows_v1(
                canonical_rows,
                last_true_m1_time=int(since_time),
                overlap_bars=int(overlap_bars),
            )
            payload = _build_incremental_m1_check_payload(
                symbol=symbol,
                raw_rows=raw_rows,
                validation=validation,
                published_at=published_at,
                base={
                    "firstTime": base_first_time,
                    "lastTime": base_last_time or since_time,
                    "trueM1RowsCount": base_true_m1_rows_count,
                    "mt5RowsCount": base_mt5_rows_count,
                },
                staged={
                    "jobId": job_id,
                    "mode": "incremental",
                    "overlapBars": overlap_bars,
                    "sinceTime": since_time,
                    "rangeRowsCount": len(raw_rows),
                },
            )
            _set_m1_check_job(
                job_id,
                ok=payload.get("ok"),
                phase="completed" if payload.get("ok") else "failed",
                status=payload.get("status"),
                progressPercent=100,
                mt5RowsCount=len(raw_rows),
                result=payload,
                finishedAt=utc_now_iso(),
            )
            return

        pos = 0
        chunk_index = 0
        while pos < max_count:
            job = _get_m1_check_job(job_id)
            if job and job.get("cancelRequested"):
                _set_m1_check_job(job_id, ok=False, phase="cancelled", status="mt5_m1_check_cancelled", finishedAt=utc_now_iso())
                return

            want = min(chunk, max_count - pos)
            _set_m1_check_job(
                job_id,
                ok=True,
                phase="fetching",
                status="mt5_m1_check_fetching",
                currentAction="copy_rates_from_pos",
                chunksCompleted=chunk_index,
                currentBatchIndex=chunk_index + 1,
                currentBatchRequested=want,
                currentBatchFetched=0,
                mt5RowsCount=len(raw_rows),
                currentPosition=pos,
                maxCount=max_count,
                chunkSize=chunk,
                progressPercent=round(min(99, (pos / max_count) * 100), 2) if max_count else None,
            )
            rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, pos, want)
            part = mt5_rates_to_rows(rates)
            if not part:
                break
            raw_rows.extend(part)
            chunk_index += 1
            pos += len(part)

            first_time = raw_rows[0].get("time") if raw_rows else None
            last_time = raw_rows[-1].get("time") if raw_rows else None
            _set_m1_check_job(
                job_id,
                ok=True,
                phase="fetching",
                status="mt5_m1_check_fetching",
                chunksCompleted=chunk_index,
                mt5RowsCount=len(raw_rows),
                currentPosition=pos,
                maxCount=max_count,
                chunkSize=chunk,
                currentBatchIndex=chunk_index,
                currentBatchRequested=want,
                currentBatchFetched=len(part),
                firstTime=first_time,
                lastTime=last_time,
                firstTimeText=format_utc_text(first_time),
                lastTimeText=format_utc_text(last_time),
                progressPercent=round(min(99, (pos / max_count) * 100), 2) if max_count else None,
            )
            if len(part) < want:
                break
            if pause_ms > 0:
                time.sleep(pause_ms / 1000)

        _set_m1_check_job(job_id, phase="validating", status="mt5_m1_check_validating", mt5RowsCount=len(raw_rows))
        canonical_rows = [
            mt5_row_to_m1_check_row(row, symbol=symbol, ingested_at=published_at)
            for row in raw_rows
        ]
        validation = validate_true_m1_rows_v1(canonical_rows)
        payload = _build_m1_check_payload(
            symbol=symbol,
            raw_rows=raw_rows,
            validation=validation,
            published_at=published_at,
            staged={
                "jobId": job_id,
                "chunksCompleted": chunk_index,
                "chunkSize": chunk,
                "maxCount": max_count,
                "exhausted": len(raw_rows) < max_count,
            },
        )
        _set_m1_check_job(
            job_id,
            ok=payload.get("ok"),
            phase="completed",
            status=payload.get("status"),
            progressPercent=100,
            mt5RowsCount=len(raw_rows),
            result=payload,
            finishedAt=utc_now_iso(),
        )
    except ImportError as exc:
        _set_m1_check_job(job_id, ok=False, phase="failed", status="mt5_m1_check_unavailable", error=str(exc), finishedAt=utc_now_iso())
    except Exception as exc:
        _set_m1_check_job(job_id, ok=False, phase="failed", status="mt5_m1_check_exception", error=str(exc), finishedAt=utc_now_iso())
    finally:
        if initialized:
            try:
                mt5.shutdown()
            except Exception:
                pass


def start_mt5_m1_staged_check(
    symbol: str,
    *,
    chunk: int = 200_000,
    max_count: int = 10_000_000,
    pause_ms: int = 50,
    mode: str = "refresh",
    since_time: int | None = None,
    base_first_time: int | None = None,
    base_last_time: int | None = None,
    base_true_m1_rows_count: int = 0,
    base_mt5_rows_count: int = 0,
    overlap_bars: int = 1000,
) -> dict[str, Any]:
    job_id = uuid.uuid4().hex
    now = utc_now_iso()
    with M1_CHECK_JOBS_LOCK:
        M1_CHECK_JOBS[job_id] = {
            "ok": True,
            "jobId": job_id,
            "symbol": symbol,
            "mode": mode,
            "phase": "queued",
            "status": "mt5_m1_check_queued",
            "chunkSize": chunk,
            "maxCount": max_count,
            "chunksCompleted": 0,
            "mt5RowsCount": 0,
            "progressPercent": 0,
            "createdAt": now,
            "updatedAt": now,
        }
    thread = threading.Thread(
        target=run_mt5_m1_staged_check_job,
        args=(job_id, symbol),
        kwargs={
            "chunk": chunk,
            "max_count": max_count,
            "pause_ms": pause_ms,
            "mode": mode,
            "since_time": since_time,
            "base_first_time": base_first_time,
            "base_last_time": base_last_time,
            "base_true_m1_rows_count": base_true_m1_rows_count,
            "base_mt5_rows_count": base_mt5_rows_count,
            "overlap_bars": overlap_bars,
        },
        daemon=True,
    )
    thread.start()
    return _get_m1_check_job(job_id) or {"ok": False, "error": "job_not_found", "jobId": job_id}


def has_m1_run(rows: list[dict[str, Any]], min_consecutive_rows: int = 60) -> bool:
    times = sorted({int(row.get("time") or 0) for row in rows if int(row.get("time") or 0) > 0})
    if len(times) < min_consecutive_rows:
        return False
    run = 1
    for previous, current in zip(times, times[1:]):
        if current - previous == 60:
            run += 1
            if run >= min_consecutive_rows:
                return True
        else:
            run = 1
    return False


def cleanup_direct_m1_prefix_before_time_v5(root: Path, symbol: str, cutoff_time: int, manifest_extra: dict[str, Any]) -> dict[str, Any]:
    import pandas as pd

    from python.data_warehouse.store_v5.manifest_v5 import load_manifest_v5, save_manifest_v5
    from python.data_warehouse.store_v5.ohlcv_schema_v5 import CANONICAL_COLUMNS
    from python.data_warehouse.store_v5.store_v5_paths import (
        SCHEMA_VERSION,
        STORE_VERSION,
        dataset_key,
        dataset_relative_root,
        dataset_root,
    )

    key = dataset_key(provider="mt5", symbol=symbol, mode="direct", timeframe="M1")
    rel_root = dataset_relative_root(provider="mt5", symbol=symbol, mode="direct", timeframe="M1")
    ds_root = dataset_root(provider="mt5", symbol=symbol, mode="direct", timeframe="M1", store_root=root)
    deleted_rows = 0
    kept_rows = 0
    parts_count = 0
    first_time = None
    last_time = None

    for file in list(ds_root.rglob("part-*.parquet")):
        frame = pd.read_parquet(file)
        before = int(len(frame))
        if before <= 0:
            file.unlink(missing_ok=True)
            continue
        frame = frame[frame["time"].astype("int64") >= int(cutoff_time)]
        deleted_rows += before - int(len(frame))
        if frame.empty:
            file.unlink(missing_ok=True)
            continue
        tmp = file.with_name(f"{file.name}.tmp")
        frame[CANONICAL_COLUMNS].to_parquet(tmp, index=False)
        tmp.replace(file)
        kept_rows += int(len(frame))
        parts_count += 1
        file_first = int(frame["time"].min())
        file_last = int(frame["time"].max())
        first_time = file_first if first_time is None else min(first_time, file_first)
        last_time = file_last if last_time is None else max(last_time, file_last)

    manifest = load_manifest_v5(root)
    cell = {
        **manifest.get("datasets", {}).get(key, {}),
        "provider": "mt5",
        "symbol": symbol,
        "mode": "direct",
        "timeframe": "M1",
        "baseTimeframe": None,
        "anchor": None,
        "rootPath": rel_root.as_posix(),
        "rowsCount": int(manifest_extra.get("trueM1RowsCount") or kept_rows),
        "partsCount": parts_count,
        "firstTime": first_time,
        "lastTime": last_time,
        "status": "ready",
        "dirty": False,
        "schemaVersion": SCHEMA_VERSION,
        "storeVersion": STORE_VERSION,
        **manifest_extra,
    }
    cell["rowsCount"] = int(cell.get("trueM1RowsCount") or kept_rows)
    manifest.setdefault("datasets", {})[key] = cell
    save_manifest_v5(manifest, root)
    return {
        "deletedRows": deleted_rows,
        "keptRows": kept_rows,
        "partsCount": parts_count,
        "firstTime": first_time,
        "lastTime": last_time,
    }


def run_store_v5_pull_job(job_id: str, symbol: str, *, mode: str, count: int | None, store_root: Path | None, fetch_chunk: int = 500_000) -> None:
    from python.data_warehouse.mt5.mt5_m1_integrity_validator_v1 import validate_incremental_true_m1_rows_v1, validate_true_m1_rows_v1
    from python.data_warehouse.store_v5.manifest_v5 import delete_dataset_cell, get_dataset_cell, mark_aggregated_dirty_for_symbol, upsert_dataset_cell
    from python.data_warehouse.store_v5.ohlcv_schema_v5 import mt5_row_to_canonical
    from python.data_warehouse.store_v5.partitioned_parquet_writer_v5 import append_ohlcv_part_v5
    from python.data_warehouse.store_v5.store_v5_paths import STORE_VERSION, dataset_key, dataset_root, manifest_path, resolve_store_root

    root = resolve_store_root(store_root)
    raw_key = dataset_key(provider="mt5", symbol=symbol, mode="raw_direct", timeframe="M1")
    direct_key = dataset_key(provider="mt5", symbol=symbol, mode="direct", timeframe="M1")
    initialized = False
    try:
        import MetaTrader5 as mt5

        if not mt5.initialize():
            _set_pull_job(
                job_id,
                ok=False,
                phase="failed",
                status="mt5_initialize_failed",
                mt5LastError=mt5.last_error(),
                progressPercent=None,
                progressLabel="失败：MT5 初始化失败",
                detailMessage="拉取开始前无法初始化 MT5",
                finishedAt=utc_now_iso(),
            )
            return
        initialized = True
        if not mt5.symbol_select(symbol, True):
            _set_pull_job(
                job_id,
                ok=False,
                phase="failed",
                status="mt5_symbol_select_failed",
                mt5LastError=mt5.last_error(),
                progressPercent=None,
                progressLabel=f"失败：无法选择品种 {symbol}",
                detailMessage="MT5 symbol_select 失败",
                finishedAt=utc_now_iso(),
            )
            return

        step = max(1, int(fetch_chunk))
        target = int(count) if count is not None and int(count) > 0 else None

        def read_progress(rows_fetched: int, chunks_completed: int) -> float:
            if target:
                return min(70, round((rows_fetched / target) * 70, 2))
            return min(65, 15 + chunks_completed * 3)

        def write_progress(rows_written: int, chunks_completed: int) -> float:
            if target:
                return 70 + min(26, round((rows_written / target) * 26, 2))
            return min(90, 70 + chunks_completed * 2)

        previous_first_time = None
        previous_last_time = None
        range_window: dict[str, Any] | None = None
        if mode == "refresh":
            raw_root = dataset_root(provider="mt5", symbol=symbol, mode="raw_direct", timeframe="M1", store_root=root)
            if raw_root.exists():
                shutil.rmtree(raw_root)
            delete_dataset_cell(root, raw_key)
            pos = 0
        else:
            raw_cell = get_dataset_cell(root, raw_key)
            if not raw_cell or raw_cell.get("lastTime") is None:
                mode = "refresh"
                raw_root = dataset_root(provider="mt5", symbol=symbol, mode="raw_direct", timeframe="M1", store_root=root)
                if raw_root.exists():
                    shutil.rmtree(raw_root)
                delete_dataset_cell(root, raw_key)
                pos = 0
            else:
                previous_first_time = safe_int(raw_cell.get("firstTime") or raw_cell.get("firstRawM1Time"))
                previous_last_time = safe_int(raw_cell.get("lastTime") or raw_cell.get("lastRawM1Time"))
                if previous_last_time is None:
                    mode = "refresh"
                    raw_root = dataset_root(provider="mt5", symbol=symbol, mode="raw_direct", timeframe="M1", store_root=root)
                    if raw_root.exists():
                        shutil.rmtree(raw_root)
                    delete_dataset_cell(root, raw_key)
                else:
                    overlap_bars = 1000
                    from_time = max(0, int(previous_last_time) - overlap_bars * 60)
                    range_window = {
                        "fromTime": from_time,
                        "toTime": int(datetime.now(timezone.utc).timestamp()),
                        "overlapBars": overlap_bars,
                        "previousFirstTime": previous_first_time,
                        "previousLastTime": previous_last_time,
                    }
                pos = 0

        _set_pull_job(
            job_id,
            phase="fetching",
            status="store_v5_pull_raw_m1_fetching",
            currentAction="copy_rates_from_pos",
            progressPercent=1,
            rowsFetched=0,
            rowsWritten=0,
            rawRowsCount=0,
            duplicateRows=0,
            chunksCompleted=0,
            fetchChunkSize=step,
            maxCount=target,
            currentBatchIndex=0,
            currentBatchRequested=0,
            currentBatchFetched=0,
            writeBatchRows=0,
            writeBatchWritten=0,
            pendingWriteRows=0,
            progressLabel=f"开始读取 MT5 M1，每批 {step:,} 根",
            detailMessage="正在从 MT5 读取 M1 数据",
        )

        seen_times: set[int] = set()
        write_buffer_target = 500_000
        pending_rows: list[dict[str, Any]] = []
        rows_fetched_total = 0
        rows_written_total = 0
        duplicate_rows_total = 0
        chunks = 0
        first_time = None
        last_time = None

        def keep_incremental_row(row_time: int) -> bool:
            if mode == "refresh" or previous_first_time is None or previous_last_time is None:
                return True
            return row_time < int(previous_first_time) or row_time > int(previous_last_time)

        def flush_pending_rows(progress_floor: float | None = None) -> None:
            nonlocal rows_written_total, duplicate_rows_total
            if not pending_rows:
                return
            batch_rows = len(pending_rows)
            progress_before = write_progress(rows_written_total, chunks)
            if progress_floor is not None:
                progress_before = max(progress_before, progress_floor)
            _set_pull_job(
                job_id,
                phase="writing",
                status="store_v5_pull_raw_m1_writing",
                currentAction="append_raw_direct_m1_buffer",
                progressPercent=progress_before,
                rowsFetched=rows_fetched_total,
                rowsWritten=rows_written_total,
                rawRowsCount=rows_written_total,
                duplicateRows=duplicate_rows_total,
                chunksCompleted=chunks,
                fetchChunkSize=step,
                maxCount=target,
                writeBatchRows=batch_rows,
                writeBatchWritten=0,
                pendingWriteRows=batch_rows,
                firstTimeText=format_utc_text(first_time),
                lastTimeText=format_utc_text(last_time),
                cleanStatus="pending",
                progressLabel=f"正在写入：本批 {batch_rows:,}，累计已写入 {rows_written_total:,}",
                detailMessage="正在写入 StoreV5 raw_direct/M1 parquet",
            )
            write = append_ohlcv_part_v5(
                pending_rows,
                provider="mt5",
                symbol=symbol,
                mode="raw_direct",
                timeframe="M1",
                store_root=root,
                source="mt5_terminal",
                deduplicate_existing_time=(mode != "refresh"),
                manifest_extra={
                    "mt5RowsCount": rows_fetched_total,
                    "rawRowsCount": rows_written_total + len(pending_rows),
                    "firstRawM1Time": first_time,
                    "lastRawM1Time": last_time,
                    "rawIngestStatus": "raw_m1_written",
                    "cleanStatus": "pending",
                    "lastImportAt": utc_now_iso(),
                    "lastImportMode": mode,
                    "lastPullMethod": "copy_rates_from_pos_buffered_raw_direct",
                    "lastPullChunkSize": step,
                    "lastWriteBufferTarget": write_buffer_target,
                    "lastAddedRows": len(pending_rows),
                    "lastDuplicateRows": duplicate_rows_total,
                    "dirty": False,
                    "compactRecommended": True,
                },
            )
            batch_written = int(write.get("rowsWritten") or 0)
            rows_written_total += int(write.get("rowsWritten") or 0)
            duplicate_rows_total += int(write.get("duplicateRows") or 0)
            pending_rows.clear()
            progress_after = write_progress(rows_written_total, chunks)
            if progress_floor is not None:
                progress_after = max(progress_after, progress_floor)
            _set_pull_job(
                job_id,
                phase="writing",
                status="store_v5_pull_raw_m1_write_batch_done",
                currentAction="append_raw_direct_m1_buffer_done",
                progressPercent=progress_after,
                rowsFetched=rows_fetched_total,
                rowsWritten=rows_written_total,
                rawRowsCount=rows_written_total,
                duplicateRows=duplicate_rows_total,
                chunksCompleted=chunks,
                fetchChunkSize=step,
                maxCount=target,
                writeBatchRows=batch_rows,
                writeBatchWritten=batch_written,
                pendingWriteRows=0,
                firstTimeText=format_utc_text(first_time),
                lastTimeText=format_utc_text(last_time),
                cleanStatus="pending",
                progressLabel=f"写入完成：本批写入 {batch_written:,}，累计 {rows_written_total:,}",
                detailMessage="本批 parquet 写入完成",
            )

        if range_window is not None:
            job = _get_pull_job(job_id)
            if job and job.get("cancelRequested"):
                _set_pull_job(
                    job_id,
                    ok=False,
                    phase="cancelled",
                    status="store_v5_pull_cancelled",
                    rowsFetched=0,
                    rowsWritten=0,
                    rawRowsCount=0,
                    duplicateRows=0,
                    progressLabel="已取消",
                    detailMessage="用户取消了 StoreV5 拉取任务",
                    finishedAt=utc_now_iso(),
                )
                return

            from_time = int(range_window["fromTime"])
            to_time = int(range_window["toTime"])
            _set_pull_job(
                job_id,
                phase="fetching",
                status="store_v5_pull_raw_m1_incremental_requesting",
                currentAction="copy_rates_range",
                progressPercent=15,
                rowsFetched=0,
                rowsWritten=0,
                rawRowsCount=0,
                duplicateRows=0,
                chunksCompleted=0,
                fetchChunkSize=step,
                maxCount=target,
                currentBatchIndex=1,
                currentBatchRequested=0,
                currentBatchFetched=0,
                writeBatchRows=0,
                writeBatchWritten=0,
                pendingWriteRows=0,
                cleanStatus="pending",
                progressLabel=f"增量读取：从 {format_utc_text(from_time)} 到 {format_utc_text(to_time)}",
                detailMessage="正在按 StoreV5 lastTime overlap 从 MT5 读取增量 M1",
            )
            rates = mt5.copy_rates_range(
                symbol,
                mt5.TIMEFRAME_M1,
                datetime.fromtimestamp(from_time, tz=timezone.utc),
                datetime.fromtimestamp(to_time, tz=timezone.utc),
            )
            part = mt5_rates_to_rows(rates)
            rows_fetched_total = len(part)
            chunks = 1 if part else 0
            new_part = []
            for row in part:
                row_time = int(row.get("time") or 0)
                if row_time <= 0 or row_time in seen_times:
                    duplicate_rows_total += 1
                    continue
                seen_times.add(row_time)
                if not keep_incremental_row(row_time):
                    duplicate_rows_total += 1
                    continue
                new_part.append(row)

            if new_part:
                canonical_batch = [mt5_row_to_canonical(row, provider="mt5", symbol=symbol, timeframe="M1") for row in new_part]
                batch_first = min((int(row["time"]) for row in canonical_batch), default=None)
                batch_last = max((int(row["time"]) for row in canonical_batch), default=None)
                first_time = batch_first if first_time is None else min(first_time, batch_first or first_time)
                last_time = batch_last if last_time is None else max(last_time, batch_last or last_time)
                pending_rows.extend(canonical_batch)

            _set_pull_job(
                job_id,
                phase="fetching",
                status="store_v5_pull_raw_m1_incremental_fetched",
                currentAction="copy_rates_range_done",
                progressPercent=65,
                rowsFetched=rows_fetched_total,
                rowsWritten=rows_written_total,
                rawRowsCount=rows_written_total,
                duplicateRows=duplicate_rows_total,
                chunksCompleted=chunks,
                fetchChunkSize=step,
                maxCount=target,
                currentBatchIndex=1,
                currentBatchRequested=0,
                currentBatchFetched=len(part),
                writeBatchRows=len(new_part),
                writeBatchWritten=0,
                pendingWriteRows=len(pending_rows),
                firstTimeText=format_utc_text(first_time),
                lastTimeText=format_utc_text(last_time),
                cleanStatus="pending",
                progressLabel=f"增量读取完成：MT5 返回 {len(part):,}，新增候选 {len(new_part):,}，跳过 {duplicate_rows_total:,}",
                detailMessage="已按 lastTime overlap 过滤已有 M1",
            )

        while range_window is None and (target is None or pos < target):
            job = _get_pull_job(job_id)
            if job and job.get("cancelRequested"):
                _set_pull_job(
                    job_id,
                    ok=False,
                    phase="cancelled",
                    status="store_v5_pull_cancelled",
                    rowsFetched=rows_fetched_total,
                    rowsWritten=rows_written_total,
                    rawRowsCount=rows_written_total,
                    duplicateRows=duplicate_rows_total,
                    progressLabel="已取消",
                    detailMessage="用户取消了 StoreV5 拉取任务",
                    finishedAt=utc_now_iso(),
                )
                return

            want = step if target is None else min(step, target - pos)
            current_batch_index = chunks + 1
            _set_pull_job(
                job_id,
                phase="fetching",
                status="store_v5_pull_raw_m1_requesting",
                currentAction="copy_rates_from_pos",
                progressPercent=read_progress(rows_fetched_total, chunks),
                rowsFetched=rows_fetched_total,
                rowsWritten=rows_written_total,
                rawRowsCount=rows_written_total,
                duplicateRows=duplicate_rows_total,
                chunksCompleted=chunks,
                fetchChunkSize=step,
                maxCount=target,
                currentBatchIndex=current_batch_index,
                currentBatchRequested=want,
                currentBatchFetched=0,
                writeBatchRows=0,
                writeBatchWritten=0,
                pendingWriteRows=len(pending_rows),
                firstTimeText=format_utc_text(first_time),
                lastTimeText=format_utc_text(last_time),
                cleanStatus="pending",
                progressLabel=(
                    f"正在请求第 {current_batch_index} 批：计划读取 {want:,}，"
                    f"累计已读取 {rows_fetched_total:,}" + (f" / {target:,}" if target else "")
                ),
                detailMessage="正在等待 MT5 返回 M1 数据",
            )
            part = mt5_rates_to_rows(mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, pos, want))
            if not part:
                break
            pos += len(part)
            rows_fetched_total += len(part)
            current_batch_fetched = len(part)

            new_part: list[dict[str, Any]] = []
            for row in part:
                row_time = int(row.get("time") or 0)
                if row_time <= 0 or row_time in seen_times:
                    duplicate_rows_total += 1
                    continue
                seen_times.add(row_time)
                if not keep_incremental_row(row_time):
                    duplicate_rows_total += 1
                    continue
                new_part.append(row)

            if new_part:
                canonical_batch = [mt5_row_to_canonical(row, provider="mt5", symbol=symbol, timeframe="M1") for row in new_part]
                batch_first = min((int(row["time"]) for row in canonical_batch), default=None)
                batch_last = max((int(row["time"]) for row in canonical_batch), default=None)
                first_time = batch_first if first_time is None else min(first_time, batch_first or first_time)
                last_time = batch_last if last_time is None else max(last_time, batch_last or last_time)
                pending_rows.extend(canonical_batch)
                if len(pending_rows) >= write_buffer_target:
                    _set_pull_job(
                        job_id,
                        phase="writing",
                        status="store_v5_pull_raw_m1_writing",
                        currentAction="append_raw_direct_m1_buffer",
                        progressPercent=write_progress(rows_written_total, chunks),
                        rowsFetched=rows_fetched_total,
                        rowsWritten=rows_written_total,
                        rawRowsCount=rows_written_total,
                        duplicateRows=duplicate_rows_total,
                        chunksCompleted=chunks,
                        fetchChunkSize=step,
                        maxCount=target,
                        writeBatchRows=len(pending_rows),
                        writeBatchWritten=0,
                        pendingWriteRows=len(pending_rows),
                        firstTimeText=format_utc_text(first_time),
                        lastTimeText=format_utc_text(last_time),
                        cleanStatus="pending",
                        progressLabel=f"正在写入：本批 {len(pending_rows):,}，累计已写入 {rows_written_total:,}",
                        detailMessage="正在写入 StoreV5 raw_direct/M1 parquet",
                    )
                    flush_pending_rows()

            chunks += 1
            _set_pull_job(
                job_id,
                phase="fetching",
                status="store_v5_pull_raw_m1_streaming",
                currentAction="copy_rates_from_pos_buffer_raw_direct_m1",
                progressPercent=read_progress(rows_fetched_total, chunks),
                rowsFetched=rows_fetched_total,
                rowsWritten=rows_written_total,
                rawRowsCount=rows_written_total,
                duplicateRows=duplicate_rows_total,
                chunksCompleted=chunks,
                fetchChunkSize=step,
                maxCount=target,
                currentBatchIndex=current_batch_index,
                currentBatchRequested=want,
                currentBatchFetched=current_batch_fetched,
                writeBatchRows=len(new_part),
                writeBatchWritten=rows_written_total,
                pendingWriteRows=len(pending_rows),
                firstTimeText=format_utc_text(first_time),
                lastTimeText=format_utc_text(last_time),
                cleanStatus="pending",
                progressLabel=(
                    f"正在读取第 {current_batch_index} 批：本批 {current_batch_fetched:,}，"
                    f"累计 {rows_fetched_total:,}" + (f" / {target:,}" if target else "")
                ),
                detailMessage="正在从 MT5 读取 M1 数据",
            )
            if len(part) < want:
                break

        _set_pull_job(
            job_id,
            phase="writing",
            status="store_v5_pull_raw_m1_final_writing",
            currentAction="append_raw_direct_m1_final_buffer",
            progressPercent=96,
            rowsFetched=rows_fetched_total,
            rowsWritten=rows_written_total,
            rawRowsCount=rows_written_total,
            duplicateRows=duplicate_rows_total,
            chunksCompleted=chunks,
            fetchChunkSize=step,
            maxCount=target,
            writeBatchRows=len(pending_rows),
            writeBatchWritten=0,
            pendingWriteRows=len(pending_rows),
            firstTimeText=format_utc_text(first_time),
            lastTimeText=format_utc_text(last_time),
            cleanStatus="pending",
            progressLabel=f"正在写入最后一批：{len(pending_rows):,}",
            detailMessage="正在写入最后一批 StoreV5 parquet",
        )
        flush_pending_rows(progress_floor=96)

        _set_pull_job(
            job_id,
            phase="finalizing",
            status="store_v5_pull_manifest_finalizing",
            currentAction="finalize_manifest",
            progressPercent=98,
            rowsFetched=rows_fetched_total,
            rowsWritten=rows_written_total,
            rawRowsCount=rows_written_total,
            duplicateRows=duplicate_rows_total,
            chunksCompleted=chunks,
            fetchChunkSize=step,
            maxCount=target,
            writeBatchRows=0,
            writeBatchWritten=0,
            pendingWriteRows=0,
            firstTimeText=format_utc_text(first_time),
            lastTimeText=format_utc_text(last_time),
            cleanStatus="pending",
            progressLabel="正在更新 Manifest 与标记聚合状态",
            detailMessage="正在刷新 StoreV5 manifest",
        )

        direct_cell = get_dataset_cell(root, direct_key)
        if direct_cell:
            upsert_dataset_cell(
                root,
                direct_key,
                {
                    **direct_cell,
                    "status": "stale",
                    "dirty": True,
                    "cleanStatus": "stale",
                    "staleReason": "raw_direct_updated",
                    "updatedAt": utc_now_iso(),
                },
            )
        mark_aggregated_dirty_for_symbol(root, provider="mt5", symbol=symbol)
        report = {
            "ok": True,
            "status": "mt5_m1_raw_refresh_completed" if mode == "refresh" else "mt5_m1_raw_incremental_completed",
            "symbol": symbol,
            "storeVersion": STORE_VERSION,
            "importMode": mode,
            "datasetMode": "raw_direct",
            "mt5RowsCount": rows_fetched_total,
            "rawRowsCount": rows_written_total,
            "rowsWritten": rows_written_total,
            "duplicateRows": duplicate_rows_total,
            "firstRawM1Time": first_time,
            "lastRawM1Time": last_time,
            "cleanStatus": "pending",
            "manifestPath": str(manifest_path(root)),
        }
        _set_pull_job(
            job_id,
            ok=True,
            phase="completed",
            status=report["status"],
            progressPercent=100,
            rowsFetched=rows_fetched_total,
            rowsWritten=rows_written_total,
            rawRowsCount=rows_written_total,
            duplicateRows=duplicate_rows_total,
            cleanStatus="pending",
            firstTimeText=format_utc_text(first_time),
            lastTimeText=format_utc_text(last_time),
            progressLabel=f"完成：读取 {rows_fetched_total:,}，写入 {rows_written_total:,}，重复 {duplicate_rows_total:,}",
            detailMessage="本地 M1 raw_direct 已更新",
            result=report,
            finishedAt=utc_now_iso(),
        )
    except Exception as exc:
        local_vars = locals()
        _set_pull_job(
            job_id,
            ok=False,
            phase="failed",
            status="store_v5_pull_exception",
            error=str(exc),
            progressPercent=None,
            rowsFetched=int(local_vars.get("rows_fetched_total") or 0),
            rowsWritten=int(local_vars.get("rows_written_total") or 0),
            rawRowsCount=int(local_vars.get("rows_written_total") or 0),
            duplicateRows=int(local_vars.get("duplicate_rows_total") or 0),
            progressLabel=f"失败：{exc}",
            detailMessage="拉取或写入过程中发生错误",
            finishedAt=utc_now_iso(),
        )
    finally:
        if initialized:
            try:
                mt5.shutdown()
            except Exception:
                pass
    return
    if mode == "incremental":
        _set_pull_job(job_id, phase="fetching", status="store_v5_pull_incremental_fetching", currentAction="copy_rates_from_pos")
        initialized = False
        try:
            direct_key = dataset_key(provider="mt5", symbol=symbol, mode="direct", timeframe="M1")
            cell = get_dataset_cell(root, direct_key)
            if not cell or cell.get("lastTrueM1Time") is None:
                _set_pull_job(
                    job_id,
                    ok=False,
                    phase="failed",
                    status="direct_m1_manifest_missing_for_incremental",
                    error="direct_m1_manifest_missing_for_incremental",
                    finishedAt=utc_now_iso(),
                )
                return
            last_true_time = int(cell["lastTrueM1Time"])
            previous_true_count = int(cell.get("trueM1RowsCount") or cell.get("rowsCount") or 0)
            previous_mt5_count = int(cell.get("mt5RowsCount") or previous_true_count)

            import MetaTrader5 as mt5

            if not mt5.initialize():
                _set_pull_job(job_id, ok=False, phase="failed", status="mt5_initialize_failed", mt5LastError=mt5.last_error(), finishedAt=utc_now_iso())
                return
            initialized = True
            if not mt5.symbol_select(symbol, True):
                _set_pull_job(job_id, ok=False, phase="failed", status="mt5_symbol_select_failed", mt5LastError=mt5.last_error(), finishedAt=utc_now_iso())
                return

            raw_rows: list[dict[str, Any]] = []
            seen_times: set[int] = set()
            pos = 0
            chunks = 0
            step = max(1, int(fetch_chunk))
            reached_existing = False
            while True:
                job = _get_pull_job(job_id)
                if job and job.get("cancelRequested"):
                    _set_pull_job(job_id, ok=False, phase="cancelled", status="store_v5_pull_cancelled", finishedAt=utc_now_iso())
                    return
                part = mt5_rates_to_rows(mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, pos, step))
                if not part:
                    break
                pos += len(part)
                new_part: list[dict[str, Any]] = []
                for row in part:
                    row_time = int(row.get("time") or 0)
                    if row_time <= 0 or row_time in seen_times:
                        continue
                    seen_times.add(row_time)
                    if row_time < last_true_time:
                        reached_existing = True
                        continue
                    new_part.append(row)
                    if row_time == last_true_time:
                        reached_existing = True
                if new_part:
                    raw_rows.extend(new_part)
                chunks += 1
                first_time = min(seen_times) if seen_times else None
                last_time = max(seen_times) if seen_times else None
                _set_pull_job(
                    job_id,
                    phase="fetching",
                    status="store_v5_pull_incremental_fetching",
                    currentAction="copy_rates_from_pos",
                    rowsFetched=len(raw_rows),
                    chunksCompleted=chunks,
                    fetchChunkSize=step,
                    maxCount=None,
                    firstTimeText=format_utc_text(first_time),
                    lastTimeText=format_utc_text(last_time),
                    localLastTrueM1Time=last_true_time,
                    localLastTrueM1Text=format_utc_text(last_true_time),
                )
                if reached_existing or len(part) < step:
                    break

            if not reached_existing:
                report = {
                    "ok": False,
                    "error": "incremental_existing_boundary_not_found",
                    "symbol": symbol,
                    "storeVersion": STORE_VERSION,
                    "importMode": mode,
                    "lastTrueM1Time": last_true_time,
                    "mt5RowsCount": len(raw_rows),
                    "rowsWritten": 0,
                }
                _set_pull_job(job_id, ok=False, phase="failed", status="incremental_existing_boundary_not_found", result=report, finishedAt=utc_now_iso())
                return

            _set_pull_job(job_id, phase="validating", status="store_v5_pull_incremental_validating", rowsFetched=len(raw_rows))
            canonical_rows = [mt5_row_to_canonical(row, provider="mt5", symbol=symbol, timeframe="M1") for row in raw_rows]
            validation = validate_incremental_true_m1_rows_v1(canonical_rows, last_true_m1_time=last_true_time)
            if not validation.get("ok"):
                report = {**validation, "symbol": symbol, "storeVersion": STORE_VERSION, "importMode": mode, "rowsWritten": 0}
                _set_pull_job(
                    job_id,
                    ok=False,
                    phase="failed",
                    status=validation.get("error") or "store_v5_pull_incremental_validation_failed",
                    trueM1RowsCount=validation.get("trueM1RowsCount", 0),
                    result=report,
                    finishedAt=utc_now_iso(),
                )
                return

            true_new_rows = validation["trueRows"]
            _set_pull_job(job_id, phase="writing", status="store_v5_pull_incremental_writing", trueM1RowsCount=len(true_new_rows))
            extra = {
                "mt5RowsCount": previous_mt5_count + len(true_new_rows),
                "lastPullMt5RowsCount": validation["mt5RowsCount"],
                "trueM1RowsCount": previous_true_count + len(true_new_rows),
                "lastTrueM1Time": validation.get("lastNewTime", last_true_time),
                "lastImportAt": utc_now_iso(),
                "lastImportMode": mode,
                "lastPullMethod": "copy_rates_from_pos_until_existing",
                "lastPullChunkSize": step,
                "lastAddedRows": len(true_new_rows),
                "lastDuplicateRows": max(0, validation["mt5RowsCount"] - len(true_new_rows)),
                "dirty": False,
                "compactRecommended": False,
            }
            write = append_ohlcv_part_v5(
                true_new_rows,
                provider="mt5",
                symbol=symbol,
                mode="direct",
                timeframe="M1",
                store_root=root,
                source="mt5_terminal",
                manifest_extra=extra,
            )
            _set_pull_job(
                job_id,
                phase="validating",
                status="store_v5_pull_checking_invalid_fields",
                currentAction="validate_written_fields",
                rowsFetched=validation["mt5RowsCount"],
                rowsWritten=write["rowsWritten"],
                trueM1RowsCount=len(true_new_rows),
            )
            time.sleep(0.65)
            _set_pull_job(
                job_id,
                phase="cleaning",
                status="store_v5_pull_deleting_invalid_fields",
                currentAction="cleanup_invalid_fields",
                rowsFetched=validation["mt5RowsCount"],
                rowsWritten=write["rowsWritten"],
                trueM1RowsCount=len(true_new_rows),
                cleanupDeletedRows=0,
            )
            time.sleep(0.65)
            mark_aggregated_dirty_for_symbol(root, provider="mt5", symbol=symbol)
            report = {
                "ok": True,
                "status": "mt5_m1_incremental_completed" if true_new_rows else "no_new_true_m1_rows",
                "symbol": symbol,
                "storeVersion": STORE_VERSION,
                "importMode": mode,
                "mt5RowsCount": validation["mt5RowsCount"],
                "trueM1RowsCount": len(true_new_rows),
                "rowsWritten": write["rowsWritten"],
                "duplicateRows": write["duplicateRows"],
                "lastTrueM1Time": extra["lastTrueM1Time"],
                "manifestPath": str(manifest_path(root)),
            }
            _set_pull_job(
                job_id,
                ok=True,
                phase="completed",
                status=report["status"],
                rowsFetched=validation["mt5RowsCount"],
                rowsWritten=write["rowsWritten"],
                trueM1RowsCount=len(true_new_rows),
                result=report,
                finishedAt=utc_now_iso(),
            )
        except Exception as exc:
            _set_pull_job(job_id, ok=False, phase="failed", status="store_v5_pull_exception", error=str(exc), finishedAt=utc_now_iso())
        finally:
            if initialized:
                try:
                    mt5.shutdown()
                except Exception:
                    pass
        return

    initialized = False
    raw_rows: list[dict[str, Any]] = []
    try:
        import MetaTrader5 as mt5

        if not mt5.initialize():
            _set_pull_job(job_id, ok=False, phase="failed", status="mt5_initialize_failed", mt5LastError=mt5.last_error(), finishedAt=utc_now_iso())
            return
        initialized = True
        if not mt5.symbol_select(symbol, True):
            _set_pull_job(job_id, ok=False, phase="failed", status="mt5_symbol_select_failed", mt5LastError=mt5.last_error(), finishedAt=utc_now_iso())
            return

        pos = 0
        chunks = 0
        step = max(1, int(fetch_chunk))
        target = int(count) if count is not None and int(count) > 0 else None
        _set_pull_job(
            job_id,
            phase="fetching",
            status="store_v5_pull_fetching",
            currentAction="copy_rates_from_pos",
            rowsFetched=0,
            chunksCompleted=0,
            fetchChunkSize=step,
            maxCount=target,
        )
        direct_key = dataset_key(provider="mt5", symbol=symbol, mode="direct", timeframe="M1")
        ds_root = dataset_root(provider="mt5", symbol=symbol, mode="direct", timeframe="M1", store_root=root)
        if ds_root.exists():
            shutil.rmtree(ds_root)
        delete_dataset_cell(root, direct_key)

        seen_times: set[int] = set()
        rows_written_total = 0
        duplicate_rows_total = 0
        first_time = None
        last_time = None
        while target is None or pos < target:
            job = _get_pull_job(job_id)
            if job and job.get("cancelRequested"):
                _set_pull_job(job_id, ok=False, phase="cancelled", status="store_v5_pull_cancelled", finishedAt=utc_now_iso())
                return
            want = step if target is None else min(step, target - pos)
            part = mt5_rates_to_rows(mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, pos, want))
            if not part:
                break
            candidate_part: list[dict[str, Any]] = []
            for row in part:
                row_time = int(row.get("time") or 0)
                if row_time <= 0 or row_time in seen_times:
                    continue
                candidate_part.append(row)
            pos += len(part)
            new_part = candidate_part
            if not new_part:
                _set_pull_job(
                    job_id,
                    phase="checking",
                    status="store_v5_pull_reached_duplicate_tail",
                    currentAction="copy_rates_from_pos",
                    rowsFetched=len(raw_rows),
                    rowsWritten=rows_written_total,
                    chunksCompleted=chunks,
                    fetchChunkSize=step,
                    maxCount=target,
                )
                break
            for row in new_part:
                seen_times.add(int(row.get("time") or 0))
            raw_rows.extend(new_part)
            chunks += 1
            canonical_batch = [mt5_row_to_canonical(row, provider="mt5", symbol=symbol, timeframe="M1") for row in new_part]
            batch_first = int(canonical_batch[0]["time"]) if canonical_batch else None
            batch_last = int(canonical_batch[-1]["time"]) if canonical_batch else None
            first_time = batch_first if first_time is None else min(first_time, batch_first or first_time)
            last_time = batch_last if last_time is None else max(last_time, batch_last or last_time)
            write = append_ohlcv_part_v5(
                canonical_batch,
                provider="mt5",
                symbol=symbol,
                mode="direct",
                timeframe="M1",
                store_root=root,
                source="mt5_terminal",
                deduplicate_existing_time=False,
                manifest_extra={
                    "mt5RowsCount": len(raw_rows),
                    "trueM1RowsCount": rows_written_total + len(canonical_batch),
                    "lastTrueM1Time": batch_last,
                    "m1IntegrityStatus": "pending_prefix_cleanup",
                    "lastImportAt": utc_now_iso(),
                    "lastImportMode": mode,
                    "lastPullMethod": "copy_rates_from_pos_streaming",
                    "lastPullChunkSize": step,
                    "lastAddedRows": len(canonical_batch),
                    "lastDuplicateRows": 0,
                    "dirty": False,
                    "compactRecommended": True,
                },
            )
            batch_written = int(write.get("rowsWritten") or 0)
            rows_written_total += batch_written
            duplicate_rows_total += int(write.get("duplicateRows") or 0)
            _set_pull_job(
                job_id,
                phase="streaming",
                status="store_v5_pull_streaming_read_write",
                currentAction="copy_rates_from_pos_and_append_ohlcv_part_v5",
                rowsFetched=len(raw_rows),
                rowsWritten=rows_written_total,
                chunksCompleted=chunks,
                fetchChunkSize=step,
                maxCount=target,
                writeBatchRows=len(canonical_batch),
                writeBatchWritten=batch_written,
                firstTimeText=format_utc_text(first_time),
                lastTimeText=format_utc_text(last_time),
            )
            if len(part) < want:
                break

        _set_pull_job(
            job_id,
            phase="checking",
            status="store_v5_pull_checking_invalid_data",
            currentAction="validate_true_m1_rows",
            rowsFetched=len(raw_rows),
            rowsWritten=rows_written_total,
            chunksCompleted=chunks,
            fetchChunkSize=step,
            maxCount=target,
        )
        canonical_rows = [mt5_row_to_canonical(row, provider="mt5", symbol=symbol, timeframe="M1") for row in raw_rows]
        validation = validate_true_m1_rows_v1(canonical_rows)
        if not validation.get("ok"):
            report = {**validation, "symbol": symbol, "storeVersion": STORE_VERSION, "importMode": mode, "rowsWritten": 0}
            _set_pull_job(
                job_id,
                ok=False,
                phase="failed",
                status=validation.get("error") or "store_v5_pull_validation_failed",
                trueM1RowsCount=validation.get("trueM1RowsCount", 0),
                discardedBeforeTrueM1RowsCount=validation.get("discardedBeforeTrueM1RowsCount", 0),
                gapCount=validation.get("gapCount", 0),
                result=report,
                finishedAt=utc_now_iso(),
            )
            return

        manifest_extra = {
            "mt5RowsCount": validation["mt5RowsCount"],
            "trueM1RowsCount": validation["trueM1RowsCount"],
            "discardedBeforeAnchorRowsCount": validation["discardedBeforeAnchorRowsCount"],
            "discardedBeforeTrueM1RowsCount": validation["discardedBeforeTrueM1RowsCount"],
            "firstAnchorTime": validation["firstAnchorTime"],
            "firstAnchorText": validation["firstAnchorText"],
            "firstTrueM1Time": validation["firstTrueM1Time"],
            "firstTrueM1Text": validation["firstTrueM1Text"],
            "lastTrueM1Time": validation["lastTrueM1Time"],
            "firstHourM1CheckOk": validation["firstHourM1CheckOk"],
            "firstHourExpectedRows": validation["firstHourExpectedRows"],
            "firstHourTrueRows": validation["firstHourTrueRows"],
            "gapCount": validation["gapCount"],
            "firstGap": validation["firstGap"],
            "m1IntegrityStatus": validation["m1IntegrityStatus"],
            "lastImportAt": utc_now_iso(),
            "lastImportMode": mode,
            "lastPullMethod": "copy_rates_from_pos_streaming",
            "lastPullChunkSize": step,
            "lastAddedRows": validation["trueM1RowsCount"],
            "lastDuplicateRows": duplicate_rows_total,
            "dirty": False,
            "compactRecommended": False,
        }
        discarded_prefix = int(validation.get("discardedBeforeTrueM1RowsCount") or 0)
        cutoff_time = int(validation.get("firstTrueM1Time") or validation.get("firstAnchorTime"))
        _set_pull_job(
            job_id,
            phase="cleaning",
            status="store_v5_pull_cleaning_invalid_prefix" if discarded_prefix else "store_v5_pull_no_invalid_prefix",
            currentAction="cleanup_invalid_prefix",
            rowsFetched=validation["mt5RowsCount"],
            rowsWritten=rows_written_total,
            trueM1RowsCount=validation["trueM1RowsCount"],
            discardedBeforeTrueM1RowsCount=validation["discardedBeforeTrueM1RowsCount"],
            gapCount=validation["gapCount"],
            cleanupStatus="running",
        )
        if discarded_prefix:
            manifest_extra["lastPullMethod"] = "copy_rates_from_pos_streaming_then_cleanup"
            cleanup = cleanup_direct_m1_prefix_before_time_v5(root, symbol, cutoff_time, manifest_extra)
        else:
            finalize_write = append_ohlcv_part_v5(
                [],
                provider="mt5",
                symbol=symbol,
                mode="direct",
                timeframe="M1",
                store_root=root,
                source="mt5_terminal",
                deduplicate_existing_time=False,
                manifest_extra=manifest_extra,
            )
            cleanup = {
                "deletedRows": 0,
                "keptRows": validation["trueM1RowsCount"],
                "partsCount": finalize_write.get("manifestCell", {}).get("partsCount"),
                "firstTime": validation["firstTrueM1Time"],
                "lastTime": validation["lastTrueM1Time"],
            }
        mark_aggregated_dirty_for_symbol(root, provider="mt5", symbol=symbol)
        _set_pull_job(
            job_id,
            phase="validating",
            status="store_v5_pull_checking_invalid_fields",
            currentAction="validate_written_fields",
            rowsFetched=validation["mt5RowsCount"],
            rowsWritten=rows_written_total,
            trueM1RowsCount=validation["trueM1RowsCount"],
            discardedBeforeTrueM1RowsCount=validation["discardedBeforeTrueM1RowsCount"],
            gapCount=validation["gapCount"],
        )
        time.sleep(0.65)
        _set_pull_job(
            job_id,
            phase="cleaning",
            status="store_v5_pull_deleting_invalid_fields",
            currentAction="cleanup_invalid_fields",
            rowsFetched=validation["mt5RowsCount"],
            rowsWritten=rows_written_total,
            trueM1RowsCount=validation["trueM1RowsCount"],
            discardedBeforeTrueM1RowsCount=validation["discardedBeforeTrueM1RowsCount"],
            gapCount=validation["gapCount"],
            cleanupDeletedRows=0,
        )
        time.sleep(0.65)
        report = {
            "ok": True,
            "status": "mt5_m1_refresh_completed",
            "symbol": symbol,
            "storeVersion": STORE_VERSION,
            "importMode": mode,
            "mt5RowsCount": validation["mt5RowsCount"],
            "trueM1RowsCount": validation["trueM1RowsCount"],
            "rowsWritten": cleanup["keptRows"],
            "duplicateRows": duplicate_rows_total,
            "cleanupDeletedRows": cleanup["deletedRows"],
            "manifestPath": str(manifest_path(root)),
        }
        _set_pull_job(
            job_id,
            ok=True,
            phase="completed",
            status="mt5_m1_refresh_completed",
            rowsFetched=validation["mt5RowsCount"],
            rowsWritten=cleanup["keptRows"],
            trueM1RowsCount=validation["trueM1RowsCount"],
            discardedBeforeTrueM1RowsCount=validation["discardedBeforeTrueM1RowsCount"],
            gapCount=validation["gapCount"],
            cleanupStatus="completed",
            cleanupDeletedRows=cleanup["deletedRows"],
            cleanupKeptRows=cleanup["keptRows"],
            firstTimeText=format_utc_text(cleanup["firstTime"]),
            lastTimeText=format_utc_text(cleanup["lastTime"]),
            result=report,
            finishedAt=utc_now_iso(),
        )
    except Exception as exc:
        _set_pull_job(job_id, ok=False, phase="failed", status="store_v5_pull_exception", error=str(exc), finishedAt=utc_now_iso())
    finally:
        if initialized:
            try:
                mt5.shutdown()
            except Exception:
                pass


def start_store_v5_pull_job(symbol: str, *, mode: str, count: int | None, store_root: Path | None = None) -> dict[str, Any]:
    job_id = uuid.uuid4().hex
    now = utc_now_iso()
    with PULL_JOBS_CONDITION:
        job = {
            "ok": True,
            "jobId": job_id,
            "symbol": symbol,
            "mode": mode,
            "phase": "queued",
            "status": "store_v5_pull_queued",
            "currentAction": "waiting_to_start",
            "progressPercent": 0,
            "rowsFetched": 0,
            "rowsWritten": 0,
            "rawRowsCount": 0,
            "duplicateRows": 0,
            "chunksCompleted": 0,
            "fetchChunkSize": 500_000,
            "maxCount": count,
            "currentBatchIndex": 0,
            "currentBatchRequested": 0,
            "currentBatchFetched": 0,
            "writeBatchRows": 0,
            "writeBatchWritten": 0,
            "pendingWriteRows": 0,
            "progressLabel": "准备开始拉取 MT5 M1",
            "detailMessage": "正在等待 StoreV5 拉取任务启动",
            "createdAt": now,
            "updatedAt": now,
            "lastEventId": 1,
            "events": [],
        }
        snapshot = _public_pull_job_snapshot(job)
        job["events"].append({"id": 1, "event": "progress", "data": snapshot})
        PULL_JOBS[job_id] = job
        PULL_JOBS_CONDITION.notify_all()
    thread = threading.Thread(
        target=run_store_v5_pull_job,
        args=(job_id, symbol),
        kwargs={"mode": mode, "count": count, "store_root": store_root},
        daemon=True,
    )
    thread.start()
    return _get_pull_job(job_id) or {"ok": False, "error": "job_not_found", "jobId": job_id}


def check_mt5_m1_live(symbol: str, count: int = 5_000_000) -> dict[str, Any]:
    from python.data_warehouse.mt5.mt5_m1_integrity_validator_v1 import validate_true_m1_rows_v1

    published_at = utc_now_iso()
    try:
        import MetaTrader5 as mt5
    except ImportError as exc:
        return {
            "ok": False,
            "status": "mt5_m1_check_unavailable",
            "error": str(exc),
            "symbol": symbol,
            "publishedAt": published_at,
        }

    initialized = False
    try:
        if not mt5.initialize():
            return {
                "ok": False,
                "status": "mt5_m1_check_init_failed",
                "error": "mt5_initialize_failed",
                "mt5LastError": mt5.last_error(),
                "symbol": symbol,
                "publishedAt": published_at,
            }
        initialized = True

        if not mt5.symbol_select(symbol, True):
            return {
                "ok": False,
                "status": "mt5_m1_check_symbol_select_failed",
                "error": "mt5_symbol_select_failed",
                "mt5LastError": mt5.last_error(),
                "symbol": symbol,
                "publishedAt": published_at,
            }

        raw_rows = mt5_rates_to_rows(mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, int(count)))
        canonical_rows = [
            mt5_row_to_m1_check_row(row, symbol=symbol, ingested_at=published_at)
            for row in raw_rows
        ]
        validation = validate_true_m1_rows_v1(canonical_rows)
        return _build_m1_check_payload(
            symbol=symbol,
            raw_rows=raw_rows,
            validation=validation,
            published_at=published_at,
        )
    except Exception as exc:
        return {
            "ok": False,
            "status": "mt5_m1_check_exception",
            "error": str(exc),
            "symbol": symbol,
            "publishedAt": published_at,
        }
    finally:
        if initialized:
            try:
                mt5.shutdown()
            except Exception:
                pass


def pull_store_v5(symbol: str, mode: str, count: int, store_root: Path | None = None) -> dict[str, Any]:
    from python.data_warehouse.mt5.mt5_m1_pull_service_v1 import pull_mt5_m1_to_store_v5

    report = pull_mt5_m1_to_store_v5(
        symbol=symbol,
        import_mode=mode,
        count=count,
        store_root=store_root,
    )
    if mode == "incremental" and report.get("error") in {"direct_m1_manifest_missing_for_incremental", "raw_direct_m1_manifest_missing_for_incremental"}:
        report = pull_mt5_m1_to_store_v5(
            symbol=symbol,
            import_mode="refresh",
            count=count,
            store_root=store_root,
        )
        report["fallbackFrom"] = "incremental"
    return report


def clean_store_v5_direct_m1(symbol: str, store_root: Path | None = None) -> dict[str, Any]:
    from python.data_warehouse.mt5.mt5_m1_clean_service_v1 import clean_raw_m1_to_direct_store_v5

    return clean_raw_m1_to_direct_store_v5(symbol=symbol, store_root=store_root, rebuild=True)


def aggregate_store_v5(symbol: str, timeframes: list[str], rebuild: bool, store_root: Path | None = None) -> dict[str, Any]:
    from python.data_warehouse.aggregate.aggregate_from_m1_service_v1 import aggregate_from_m1_store_v5

    return aggregate_from_m1_store_v5(
        symbol=symbol,
        target_timeframes=timeframes,
        store_root=store_root,
        rebuild=rebuild,
    )


def query_store_v5_ohlcv(params: dict[str, list[str]], store_root: Path | None = None) -> dict[str, Any]:
    from python.data_warehouse.query.duckdb_ohlcv_query_v5 import query_ohlcv_store_v5

    symbol = (params.get("symbol") or [""])[0].strip()
    timeframe = (params.get("timeframe") or ["M1"])[0].strip().upper()
    mode = (params.get("mode") or ["direct"])[0].strip().lower()
    base_timeframe = (params.get("baseTimeframe") or params.get("base_timeframe") or ["M1"])[0].strip().upper()
    anchor = (params.get("anchor") or ["UTC2200"])[0].strip().upper()
    time_from = safe_query_int((params.get("timeFrom") or params.get("time_from") or [None])[0], None)
    time_to = safe_query_int((params.get("timeTo") or params.get("time_to") or [None])[0], None)
    limit = safe_query_int((params.get("limit") or ["5000"])[0], 5000)
    if not symbol:
        return {"ok": False, "status": "bad_request", "error": "symbol_required"}
    return query_ohlcv_store_v5(
        symbol=symbol,
        timeframe=timeframe,
        mode=mode,
        base_timeframe=base_timeframe if mode == "aggregated" else None,
        anchor=anchor if mode == "aggregated" else None,
        time_from=time_from,
        time_to=time_to,
        limit=limit,
        store_root=store_root,
    )


class Mt5SymbolsHandler(BaseHTTPRequestHandler):
    cache_root = DEFAULT_CACHE_ROOT
    store_root: Path | None = None

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/market-data/v1/store-v5/direct-m1/clean":
            query = parse_qs(parsed.query)
            symbol = (query.get("symbol") or [""])[0].strip()
            if not symbol:
                self.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
                return
            try:
                payload = clean_store_v5_direct_m1(symbol, store_root=self.store_root)
                self.send_json(200 if payload.get("ok") is True else 400, payload)
            except Exception as exc:
                self.send_json(500, {"ok": False, "status": "store_v5_clean_failed", "error": str(exc)})
            return
        self.send_json(404, {"ok": False, "status": "not_found", "error": parsed.path})

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/market-data/v1/mt5/m1/check/start":
            query = parse_qs(parsed.query)
            symbol = (query.get("symbol") or [""])[0].strip()
            mode = (query.get("mode") or ["refresh"])[0].strip().lower()
            chunk = clamp_m1_check_chunk((query.get("chunk") or [None])[0], default=200_000)
            max_count = clamp_m1_check_count((query.get("maxCount") or query.get("max_count") or [None])[0], default=10_000_000)
            pause_ms = max(0, min(safe_query_int((query.get("pauseMs") or query.get("pause_ms") or [None])[0], 50) or 0, 5_000))
            since_time = safe_query_int((query.get("sinceTime") or query.get("since_time") or [None])[0], None)
            base_first_time = safe_query_int((query.get("baseFirstTime") or query.get("base_first_time") or [None])[0], None)
            base_last_time = safe_query_int((query.get("baseLastTime") or query.get("base_last_time") or [None])[0], None)
            base_true_m1_rows_count = safe_query_int((query.get("baseTrueM1RowsCount") or query.get("base_true_m1_rows_count") or [None])[0], 0) or 0
            base_mt5_rows_count = safe_query_int((query.get("baseMt5RowsCount") or query.get("base_mt5_rows_count") or [None])[0], 0) or 0
            overlap_bars = safe_query_int((query.get("overlapBars") or query.get("overlap_bars") or [None])[0], 1000) or 1000
            if not symbol:
                self.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
                return
            if mode not in {"refresh", "incremental"}:
                self.send_json(400, {"ok": False, "status": "bad_request", "error": "unsupported_check_mode"})
                return
            if mode == "incremental" and since_time is None:
                self.send_json(400, {"ok": False, "status": "bad_request", "error": "since_time_required"})
                return
            self.send_json(
                202,
                start_mt5_m1_staged_check(
                    symbol,
                    chunk=chunk,
                    max_count=max_count,
                    pause_ms=pause_ms,
                    mode=mode,
                    since_time=since_time,
                    base_first_time=base_first_time,
                    base_last_time=base_last_time,
                    base_true_m1_rows_count=base_true_m1_rows_count,
                    base_mt5_rows_count=base_mt5_rows_count,
                    overlap_bars=overlap_bars,
                ),
            )
            return

        if parsed.path == "/api/market-data/v1/mt5/m1/check/progress":
            query = parse_qs(parsed.query)
            job_id = (query.get("jobId") or query.get("job_id") or [""])[0].strip()
            if not job_id:
                self.send_json(400, {"ok": False, "status": "bad_request", "error": "job_id_required"})
                return
            job = _get_m1_check_job(job_id)
            if not job:
                self.send_json(404, {"ok": False, "status": "job_not_found", "error": "job_not_found", "jobId": job_id})
                return
            self.send_json(200, job)
            return

        if parsed.path == "/api/market-data/v1/mt5/m1/check/cancel":
            query = parse_qs(parsed.query)
            job_id = (query.get("jobId") or query.get("job_id") or [""])[0].strip()
            if not job_id:
                self.send_json(400, {"ok": False, "status": "bad_request", "error": "job_id_required"})
                return
            job = _set_m1_check_job(job_id, cancelRequested=True, status="mt5_m1_check_cancel_requested")
            if not job:
                self.send_json(404, {"ok": False, "status": "job_not_found", "error": "job_not_found", "jobId": job_id})
                return
            self.send_json(200, job)
            return

        if parsed.path in {"/api/market-data/v1/mt5/m1/check", "/api/market-data/v1/store-v5/check"}:
            query = parse_qs(parsed.query)
            symbol = (query.get("symbol") or [""])[0].strip()
            count = clamp_m1_check_count((query.get("count") or [None])[0], default=200_000)
            if not symbol:
                self.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
                return
            try:
                payload = check_mt5_m1_live(symbol, count=count)
                self.send_json(200, payload)
            except Exception as exc:
                self.send_json(500, {"ok": False, "status": "mt5_m1_check_failed", "error": str(exc)})
            return

        if parsed.path == "/api/market-data/v1/store-v5/status":
            query = parse_qs(parsed.query)
            symbol = (query.get("symbol") or [""])[0].strip()
            if not symbol:
                self.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
                return
            try:
                payload = check_store_v5(symbol, store_root=self.store_root)
                self.send_json(200, payload)
            except Exception as exc:
                self.send_json(500, {"ok": False, "status": "store_v5_status_failed", "error": str(exc)})
            return

        if parsed.path == "/api/market-data/v1/store-v5/delete":
            query = parse_qs(parsed.query)
            symbol = (query.get("symbol") or [""])[0].strip()
            if not symbol:
                self.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
                return
            try:
                payload = delete_store_v5_symbol(symbol, store_root=self.store_root)
                self.send_json(200 if payload.get("ok") is True else 400, payload)
            except Exception as exc:
                self.send_json(500, {"ok": False, "status": "store_v5_delete_failed", "error": str(exc)})
            return

        if parsed.path == "/api/market-data/v1/store-v5/pull/start":
            query = parse_qs(parsed.query)
            symbol = (query.get("symbol") or [""])[0].strip()
            mode = (query.get("mode") or ["incremental"])[0].strip().lower()
            count_text = (query.get("count") or [None])[0]
            count = None if mode == "refresh" and count_text in {None, ""} else clamp_m1_check_count(count_text, default=10_000_000)
            if not symbol:
                self.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
                return
            if mode not in {"refresh", "incremental"}:
                self.send_json(400, {"ok": False, "status": "bad_request", "error": "unsupported_import_mode"})
                return
            self.send_json(202, start_store_v5_pull_job(symbol, mode=mode, count=count, store_root=self.store_root))
            return

        if parsed.path == "/api/market-data/v1/store-v5/pull/progress":
            query = parse_qs(parsed.query)
            job_id = (query.get("jobId") or query.get("job_id") or [""])[0].strip()
            if not job_id:
                self.send_json(400, {"ok": False, "status": "bad_request", "error": "job_id_required"})
                return
            job = _get_pull_job(job_id)
            if not job:
                self.send_json(404, {"ok": False, "status": "job_not_found", "error": "job_not_found", "jobId": job_id})
                return
            self.send_json(200, job)
            return

        if parsed.path == "/api/market-data/v1/store-v5/pull/events":
            query = parse_qs(parsed.query)
            job_id = (query.get("jobId") or query.get("job_id") or [""])[0].strip()
            if not job_id:
                self.send_json(400, {"ok": False, "status": "bad_request", "error": "job_id_required"})
                return
            if not _get_pull_job(job_id):
                self.send_json(404, {"ok": False, "status": "job_not_found", "error": "job_not_found", "jobId": job_id})
                return
            self.send_pull_job_events(job_id)
            return

        if parsed.path == "/api/market-data/v1/store-v5/pull/cancel":
            query = parse_qs(parsed.query)
            job_id = (query.get("jobId") or query.get("job_id") or [""])[0].strip()
            if not job_id:
                self.send_json(400, {"ok": False, "status": "bad_request", "error": "job_id_required"})
                return
            job = _set_pull_job(job_id, cancelRequested=True, status="store_v5_pull_cancel_requested")
            if not job:
                self.send_json(404, {"ok": False, "status": "job_not_found", "error": "job_not_found", "jobId": job_id})
                return
            self.send_json(200, job)
            return

        if parsed.path == "/api/market-data/v1/store-v5/pull":
            query = parse_qs(parsed.query)
            symbol = (query.get("symbol") or [""])[0].strip()
            mode = (query.get("mode") or ["incremental"])[0].strip().lower()
            count = clamp_m1_check_count((query.get("count") or [None])[0], default=10_000_000)
            if not symbol:
                self.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
                return
            try:
                payload = pull_store_v5(symbol, mode=mode, count=count, store_root=self.store_root)
                self.send_json(200 if payload.get("ok") is True else 400, payload)
            except Exception as exc:
                self.send_json(500, {"ok": False, "status": "store_v5_pull_failed", "error": str(exc)})
            return

        if parsed.path == "/api/market-data/v1/store-v5/direct-m1/clean":
            query = parse_qs(parsed.query)
            symbol = (query.get("symbol") or [""])[0].strip()
            if not symbol:
                self.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
                return
            try:
                payload = clean_store_v5_direct_m1(symbol, store_root=self.store_root)
                self.send_json(200 if payload.get("ok") is True else 400, payload)
            except Exception as exc:
                self.send_json(500, {"ok": False, "status": "store_v5_clean_failed", "error": str(exc)})
            return

        if parsed.path == "/api/market-data/v1/store-v5/aggregate":
            query = parse_qs(parsed.query)
            symbol = (query.get("symbol") or [""])[0].strip()
            raw_timeframes = (query.get("timeframes") or ["M5,M15,M30,H1,H2,H4,H8,D1,W1,MN1"])[0]
            timeframes = [item.strip().upper() for item in raw_timeframes.split(",") if item.strip()]
            rebuild = query_bool((query.get("rebuild") or ["1"])[0], default=True)
            if not symbol:
                self.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
                return
            try:
                payload = aggregate_store_v5(symbol, timeframes=timeframes, rebuild=rebuild, store_root=self.store_root)
                self.send_json(200 if payload.get("ok") is True else 400, payload)
            except Exception as exc:
                self.send_json(500, {"ok": False, "status": "store_v5_aggregate_failed", "error": str(exc)})
            return

        if parsed.path == "/api/market-data/v1/store-v5/query":
            query = parse_qs(parsed.query)
            try:
                payload = query_store_v5_ohlcv(query, store_root=self.store_root)
                self.send_json(200, payload)
            except Exception as exc:
                self.send_json(500, {"ok": False, "status": "store_v5_query_failed", "error": str(exc)})
            return

        if parsed.path not in {"/api/market-data/v1/mt5/symbols", "/api/market/mt5/symbols"}:
            self.send_json(404, {"ok": False, "status": "not_found", "error": parsed.path})
            return

        query = parse_qs(parsed.query)
        text_query = (query.get("query") or [""])[0]
        market = (query.get("market") or [""])[0]
        limit = clamp_limit((query.get("limit") or ["50000"])[0])
        refresh = (query.get("refresh") or ["0"])[0].lower() in {"1", "true", "yes"}

        payload = (
            scan_mt5_symbols(self.cache_root, query=text_query, market=market, limit=limit)
            if refresh
            else read_symbol_cache(self.cache_root, query=text_query, market=market, limit=limit)
        )
        self.send_json(200 if payload.get("ok") is True else 503, payload)

    def send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Accept, Content-Type")
        self.send_header("Cache-Control", "no-store")

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_pull_job_events(self, job_id: str) -> None:
        self.send_response(200)
        self.send_cors_headers()
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

        last_sent = 0
        while True:
            with PULL_JOBS_CONDITION:
                job = PULL_JOBS.get(job_id)
                if not job:
                    events = [{
                        "id": last_sent + 1,
                        "event": "error",
                        "data": {"ok": False, "jobId": job_id, "phase": "failed", "status": "job_not_found", "error": "job_not_found"},
                    }]
                else:
                    PULL_JOBS_CONDITION.wait_for(
                        lambda: any(int(event.get("id") or 0) > last_sent for event in job.get("events", []))
                        or str(job.get("phase") or "") in PULL_JOB_TERMINAL_PHASES,
                        timeout=15,
                    )
                    events = [
                        event for event in job.get("events", [])
                        if int(event.get("id") or 0) > last_sent
                    ]
                    if not events:
                        events = [{"id": last_sent, "event": "ping", "data": {"ok": True, "jobId": job_id, "phase": job.get("phase"), "updatedAt": utc_now_iso()}}]

            should_close = False
            for event in events:
                event_id = int(event.get("id") or last_sent)
                event_name = str(event.get("event") or "progress")
                data = event.get("data") if isinstance(event.get("data"), dict) else {}
                if event_id > last_sent:
                    last_sent = event_id
                if event_name in {"done", "error", "cancelled"}:
                    should_close = True
                try:
                    self.wfile.write(f"id: {event_id}\n".encode("utf-8"))
                    self.wfile.write(f"event: {event_name}\n".encode("utf-8"))
                    self.wfile.write(f"data: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8"))
                    self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError, OSError):
                    return
            if should_close:
                return

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[mt5_symbols_server] {self.address_string()} - {format % args}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="FractalFrame v5 MT5 symbol list HTTP bridge.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--cache-root", type=Path, default=DEFAULT_CACHE_ROOT)
    parser.add_argument("--store-root", type=Path, default=None)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    Mt5SymbolsHandler.cache_root = args.cache_root.resolve()
    Mt5SymbolsHandler.store_root = args.store_root.resolve() if args.store_root else None
    server = ThreadingHTTPServer((args.host, args.port), Mt5SymbolsHandler)
    print(f"[mt5_symbols_server] listening on http://{args.host}:{args.port}")
    print("[mt5_symbols_server] endpoint /api/market-data/v1/mt5/symbols?refresh=1")
    print("[mt5_symbols_server] endpoint /api/market-data/v1/mt5/m1/check?symbol=XAUUSDm")
    print("[mt5_symbols_server] endpoint /api/market-data/v1/store-v5/status?symbol=XAUUSDm")
    print("[mt5_symbols_server] endpoint /api/market-data/v1/store-v5/pull?symbol=XAUUSDm")
    print("[mt5_symbols_server] endpoint /api/market-data/v1/store-v5/aggregate?symbol=XAUUSDm")
    print("[mt5_symbols_server] endpoint /api/market-data/v1/store-v5/query?symbol=XAUUSDm&timeframe=M1")
    print(f"[mt5_symbols_server] cache {Mt5SymbolsHandler.cache_root}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[mt5_symbols_server] stopping")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
