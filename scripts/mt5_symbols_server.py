from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
for path in (str(SCRIPT_DIR), str(ROOT)):
    if path not in sys.path:
        sys.path.insert(0, path)

from http_bridge.mt5_m1_check_service import (
    check_mt5_m1_live,
    mt5_rates_to_rows,
    start_mt5_m1_staged_check,
)
from http_bridge.mt5_m1_check_job_state import (
    _get_m1_check_job,
    _set_m1_check_job,
)
from http_bridge.diagnostics_service import check_mt5_diagnostics, job_history, runtime_observability, tail_bridge_logs
from http_bridge.logging_config import configure_logging, get_logger
from http_bridge.response import send_cors_headers as send_cors_headers_response
from http_bridge.response import error_payload
from http_bridge.response import send_json as send_json_response
from http_bridge.response import write_sse_event
from http_bridge.mt5_m1_check_routes import handle_mt5_m1_check_get
from http_bridge.mt5_symbol_routes import handle_mt5_symbols_get
from http_bridge.indicator_routes import handle_indicator_get, handle_indicator_post
from http_bridge.indicator_service import calculate_mmf_indicator_from_rows, query_mmf_indicator
from http_bridge.sse import send_aggregate_job_events as send_aggregate_job_events_sse
from http_bridge.sse import send_mt5_tick_events as send_mt5_tick_events_sse
from http_bridge.sse import send_pull_job_events as send_pull_job_events_sse
from http_bridge.mt5_symbol_service import query_mt5_rates_live, query_mt5_tick_live, read_symbol_cache, scan_mt5_symbols
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
    list_store_v5_symbols,
)
from http_bridge.store_v5_routes import handle_store_v5_get, handle_store_v5_post


DEFAULT_CACHE_ROOT = ROOT / "runtime_data" / "instruments" / "mt5"
SERVER_SOURCE_VERSION = "mt5_symbols_server_source_v2_local_imports"
LOGGER = get_logger("mt5_symbols_server")
QUIET_ACCESS_LOG_PATHS = {
    "/api/market-data/v1/mt5/tick",
    "/api/market-data/v1/mt5/ticks/events",
}


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


def should_log_access(path: str) -> bool:
    return urlparse(path).path not in QUIET_ACCESS_LOG_PATHS


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
        if handle_indicator_post(self, parsed, services):
            return
        if handle_store_v5_post(self, parsed, services):
            return
        self.send_json(404, error_payload("not_found", parsed.path))

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        services = sys.modules[__name__]
        if parsed.path == "/api/debug/source-version":
            from http_bridge import indicator_service

            self.send_json(200, {
                "ok": True,
                "serverSourceVersion": SERVER_SOURCE_VERSION,
                "indicatorServiceFile": str(Path(indicator_service.__file__).resolve()),
                "indicatorEngineVersion": getattr(indicator_service, "_MMF_ENGINE_VERSION", None),
            })
            return
        if parsed.path == "/api/market-data/v1/diagnostics/mt5":
            from urllib.parse import parse_qs

            query = parse_qs(parsed.query)
            self.send_json(200, check_mt5_diagnostics((query.get("symbol") or [None])[0]))
            return
        if parsed.path == "/api/market-data/v1/diagnostics/runtime":
            self.send_json(200, runtime_observability(cache_root=self.cache_root, store_root=self.store_root))
            return
        if parsed.path == "/api/market-data/v1/diagnostics/jobs":
            self.send_json(200, job_history())
            return
        if parsed.path == "/api/market-data/v1/diagnostics/logs":
            from urllib.parse import parse_qs

            query = parse_qs(parsed.query)
            tail = safe_int((query.get("tail") or [200])[0]) or 200
            self.send_json(200, tail_bridge_logs(tail))
            return
        if parsed.path == "/api/market-data/v1/mt5/tick":
            from urllib.parse import parse_qs

            query = parse_qs(parsed.query)
            symbol = str((query.get("symbol") or [""])[0]).strip()
            payload = query_mt5_tick_live(symbol)
            self.send_json(200 if payload.get("ok") is True else 503, payload)
            return
        if handle_mt5_symbols_get(self, parsed, services):
            return
        if handle_mt5_m1_check_get(self, parsed, services):
            return
        if handle_indicator_get(self, parsed, services):
            return
        if handle_store_v5_get(self, parsed, services):
            return
        self.send_json(404, error_payload("not_found", parsed.path))

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
        if not should_log_access(self.path):
            return
        LOGGER.info("%s - %s", self.address_string(), format % args)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="FractalFrame v5 MT5 symbol list HTTP bridge.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--cache-root", type=Path, default=DEFAULT_CACHE_ROOT)
    parser.add_argument("--store-root", type=Path, default=None)
    return parser.parse_args()


def main() -> int:
    configure_logging()
    args = parse_args()
    Mt5SymbolsHandler.cache_root = args.cache_root.resolve()
    Mt5SymbolsHandler.store_root = args.store_root.resolve() if args.store_root else None
    server = ThreadingHTTPServer((args.host, args.port), Mt5SymbolsHandler)
    LOGGER.info("listening on http://%s:%s", args.host, args.port)
    LOGGER.info("endpoint /api/market-data/v1/mt5/symbols?refresh=1")
    LOGGER.info("endpoint /api/market-data/v1/mt5/rates?symbol=XAUUSDm&timeframe=M5")
    LOGGER.info("endpoint /api/market-data/v1/mt5/m1/check?symbol=XAUUSDm")
    LOGGER.info("endpoint /api/market-data/v1/store-v5/status?symbol=XAUUSDm")
    LOGGER.info("endpoint /api/market-data/v1/store-v5/pull?symbol=XAUUSDm")
    LOGGER.info("endpoint /api/market-data/v1/store-v5/aggregate?symbol=XAUUSDm")
    LOGGER.info("endpoint /api/market-data/v1/store-v5/query?symbol=XAUUSDm&timeframe=M1")
    LOGGER.info("cache %s", Mt5SymbolsHandler.cache_root)
    LOGGER.info("store %s", Mt5SymbolsHandler.store_root or "default runtime_data/store_v5")
    LOGGER.info("cors origin configured by FRACTALFRAME_CORS_ORIGIN")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        LOGGER.info("stopping")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())





