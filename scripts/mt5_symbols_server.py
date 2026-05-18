from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CACHE_ROOT = ROOT / "runtime_data" / "instruments" / "mt5"
SYMBOL_CACHE_FILE = "symbol_universe_info.json"
SYMBOL_REPORT_FILE = "symbol_universe_scan_report.json"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clamp_limit(value: str | None, default: int = 50_000) -> int:
    try:
        parsed = int(value or default)
    except ValueError:
        parsed = default
    return max(1, min(parsed, 50_000))


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


class Mt5SymbolsHandler(BaseHTTPRequestHandler):
    cache_root = DEFAULT_CACHE_ROOT

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
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

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[mt5_symbols_server] {self.address_string()} - {format % args}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="FractalFrame v5 MT5 symbol list HTTP bridge.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--cache-root", type=Path, default=DEFAULT_CACHE_ROOT)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    Mt5SymbolsHandler.cache_root = args.cache_root.resolve()
    server = ThreadingHTTPServer((args.host, args.port), Mt5SymbolsHandler)
    print(f"[mt5_symbols_server] listening on http://{args.host}:{args.port}")
    print("[mt5_symbols_server] endpoint /api/market-data/v1/mt5/symbols?refresh=1")
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
