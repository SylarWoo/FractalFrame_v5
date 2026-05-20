from __future__ import annotations

from typing import Any
from urllib.parse import ParseResult, parse_qs

from .query_params import clamp_limit, safe_query_int
from .route_helpers import first_query_value


def handle_mt5_symbols_get(handler: Any, parsed: ParseResult, services: Any) -> bool:
    if parsed.path == "/api/market-data/v1/mt5/ticks/events":
        query = parse_qs(parsed.query)
        symbols = services.parse_symbols_query(first_query_value(query, "symbols"))
        interval_ms = max(200, min(safe_query_int(first_query_value(query, "intervalMs", "interval_ms", default=None), 500) or 500, 5_000))
        if not symbols:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "symbols_required"})
            return True
        handler.send_mt5_tick_events(symbols, interval_ms=interval_ms)
        return True

    if parsed.path not in {"/api/market-data/v1/mt5/symbols", "/api/market/mt5/symbols"}:
        return False

    query = parse_qs(parsed.query)
    text_query = first_query_value(query, "query")
    market = first_query_value(query, "market")
    limit = clamp_limit(first_query_value(query, "limit", default="50000"))
    refresh = first_query_value(query, "refresh", default="0").lower() in {"1", "true", "yes"}
    payload = (
        services.scan_mt5_symbols(handler.cache_root, query=text_query, market=market, limit=limit)
        if refresh
        else services.read_symbol_cache(handler.cache_root, query=text_query, market=market, limit=limit)
    )
    handler.send_json(200 if payload.get("ok") is True else 503, payload)
    return True
