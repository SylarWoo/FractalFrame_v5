from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from http_bridge.mt5_m1_check_service import (
    _get_m1_check_job,
    _set_m1_check_job,
    check_mt5_m1_live,
    mt5_rates_to_rows,
    start_mt5_m1_staged_check,
)
from http_bridge.response import send_cors_headers as send_cors_headers_response
from http_bridge.response import send_json as send_json_response
from http_bridge.response import write_sse_event
from http_bridge.mt5_m1_check_routes import handle_mt5_m1_check_get
from http_bridge.mt5_symbol_routes import handle_mt5_symbols_get
from http_bridge.sse import send_aggregate_job_events as send_aggregate_job_events_sse
from http_bridge.sse import send_mt5_tick_events as send_mt5_tick_events_sse
from http_bridge.sse import send_pull_job_events as send_pull_job_events_sse
from http_bridge.mt5_symbol_service import read_symbol_cache, scan_mt5_symbols
from http_bridge.store_v5_operations_service import (
    aggregate_store_v5,
    clean_store_v5_direct_m1,
    pull_store_v5,
    query_store_v5_ohlcv,
)
from http_bridge.store_v5_aggregate_job_service import (
    _get_aggregate_job,
    _set_aggregate_job,
    start_store_v5_aggregate_job,
)
from http_bridge.store_v5_gap_repair_service import repair_store_v5_m1_gaps
from http_bridge.store_v5_pull_job_service import (
    start_store_v5_pull_job,
)
from http_bridge.store_v5_pull_job_state import (
    get_pull_job as _get_pull_job,
    set_pull_job as _set_pull_job,
)
from http_bridge.store_v5_status_service import (
    check_store_v5,
    delete_store_v5_aggregated_timeframes,
    delete_store_v5_symbol,
)
from http_bridge.store_v5_routes import handle_store_v5_get, handle_store_v5_post


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
DEFAULT_CACHE_ROOT = ROOT / "runtime_data" / "instruments" / "mt5"
def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


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


def parse_symbols_query(value: str, max_symbols: int = 80) -> list[str]:
    seen: set[str] = set()
    symbols: list[str] = []
    for item in value.split(","):
        symbol = item.strip()
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        symbols.append(symbol)
        if len(symbols) >= max_symbols:
            break
    return symbols


def mt5_tick_to_payload(mt5: Any, symbol: str, day_open: float | None) -> dict[str, Any] | None:
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return None
    raw = namedtuple_to_dict(tick)

    bid = safe_float(raw.get("bid"))
    ask = safe_float(raw.get("ask"))
    last = safe_float(raw.get("last"))
    if last is None or last <= 0:
        if bid is not None and ask is not None and bid > 0 and ask > 0:
            last = (bid + ask) / 2
        elif bid is not None and bid > 0:
            last = bid
        elif ask is not None and ask > 0:
            last = ask

    change = None
    change_percent = None
    if last is not None and day_open is not None and day_open > 0:
        change = last - day_open
        change_percent = (change / day_open) * 100

    return {
        "symbol": symbol,
        "bid": bid,
        "ask": ask,
        "last": last,
        "volume": safe_float(raw.get("volume")),
        "time": safe_int(raw.get("time")),
        "timeMsc": safe_int(raw.get("time_msc")),
        "dayOpen": day_open,
        "change": change,
        "changePercent": change_percent,
        "publishedAt": utc_now_iso(),
    }


def resolve_mt5_day_open(mt5: Any, symbol: str) -> float | None:
    try:
        rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_D1, 0, 1)
        rows = mt5_rates_to_rows(rates)
        if not rows:
            return None
        return safe_float(rows[0].get("open"))
    except Exception:
        return None


class Mt5SymbolsHandler(BaseHTTPRequestHandler):
    cache_root = DEFAULT_CACHE_ROOT
    store_root: Path | None = None

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        services = sys.modules[__name__]
        if handle_store_v5_post(self, parsed, services):
            return
        self.send_json(404, {"ok": False, "status": "not_found", "error": parsed.path})

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        services = sys.modules[__name__]
        if handle_mt5_symbols_get(self, parsed, services):
            return
        if handle_mt5_m1_check_get(self, parsed, services):
            return
        if handle_store_v5_get(self, parsed, services):
            return
        self.send_json(404, {"ok": False, "status": "not_found", "error": parsed.path})

    def send_cors_headers(self) -> None:
        send_cors_headers_response(self)

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        send_json_response(self, status, payload)

    def send_mt5_tick_events(self, symbols: list[str], interval_ms: int) -> None:
        send_mt5_tick_events_sse(
            self,
            symbols,
            interval_ms,
            utc_now_iso=utc_now_iso,
            mt5_tick_to_payload=mt5_tick_to_payload,
            resolve_mt5_day_open=resolve_mt5_day_open,
        )

    def write_sse_event(self, event_id: int, event_name: str, data: dict[str, Any]) -> None:
        write_sse_event(self, event_id, event_name, data)

    def send_pull_job_events(self, job_id: str) -> None:
        send_pull_job_events_sse(self, job_id, utc_now_iso=utc_now_iso)

    def send_aggregate_job_events(self, job_id: str) -> None:
        send_aggregate_job_events_sse(self, job_id, utc_now_iso=utc_now_iso)
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
    print(f"[mt5_symbols_server] store {Mt5SymbolsHandler.store_root or 'default runtime_data/store_v5'}")
    print(f"[mt5_symbols_server] cors origin {os.environ.get('FRACTALFRAME_CORS_ORIGIN', '*')}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[mt5_symbols_server] stopping")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())





