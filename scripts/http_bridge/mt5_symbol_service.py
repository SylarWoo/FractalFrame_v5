from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .mt5_m1_rows import mt5_rates_to_rows

SYMBOL_CACHE_FILE = "symbol_universe_info.json"
SYMBOL_REPORT_FILE = "symbol_universe_scan_report.json"
MT5_TIMEFRAME_NAMES = {
    "M1": "TIMEFRAME_M1",
    "M5": "TIMEFRAME_M5",
    "M15": "TIMEFRAME_M15",
    "M30": "TIMEFRAME_M30",
    "H1": "TIMEFRAME_H1",
    "H2": "TIMEFRAME_H2",
    "H3": "TIMEFRAME_H3",
    "H4": "TIMEFRAME_H4",
    "D1": "TIMEFRAME_D1",
    "W1": "TIMEFRAME_W1",
    "MN1": "TIMEFRAME_MN1",
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


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


def normalize_timeframe(value: str) -> str:
    timeframe = str(value or "M1").strip().upper()
    if timeframe == "1M":
        return "M1"
    if timeframe.endswith("M") and timeframe != "MN1":
        return f"M{timeframe[:-1]}"
    if timeframe.endswith("H"):
        return f"H{timeframe[:-1]}"
    return timeframe


def mt5_rate_row(row: dict[str, Any]) -> dict[str, Any] | None:
    try:
        return {
            "time": int(row["time"]),
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "volume": int(row.get("tick_volume", row.get("volume", 0)) or 0),
        }
    except (KeyError, TypeError, ValueError):
        return None


def query_mt5_tick_live(symbol: str, day_open: float | None = None) -> dict[str, Any]:
    published_at = utc_now_iso()
    base_payload = {
        "ok": False,
        "status": "mt5_tick_failed",
        "symbol": symbol,
        "tick": None,
        "publishedAt": published_at,
    }

    if not symbol:
        return {**base_payload, "status": "bad_request", "error": "symbol_required"}

    try:
        import MetaTrader5 as mt5
    except ImportError as exc:
        return {**base_payload, "status": "mt5_tick_unavailable", "error": str(exc)}

    try:
        if not mt5.initialize():
            return {
                **base_payload,
                "status": "mt5_tick_init_failed",
                "error": "mt5_initialize_failed",
                "mt5LastError": mt5.last_error(),
            }

        if not mt5.symbol_select(symbol, True):
            return {
                **base_payload,
                "status": "mt5_tick_symbol_select_failed",
                "error": "mt5_symbol_select_failed",
                "mt5LastError": mt5.last_error(),
            }

        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            return {
                **base_payload,
                "status": "mt5_tick_empty",
                "error": "symbol_info_tick_returned_none",
                "mt5LastError": mt5.last_error(),
            }
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
        return {
            "ok": True,
            "status": "mt5_tick_ready",
            "symbol": symbol,
            "tick": {
                "symbol": symbol,
                "bid": bid,
                "ask": ask,
                "last": last,
                "volume": safe_float(raw.get("volume")),
                "time": safe_int(raw.get("time")),
                "timeMsc": safe_int(raw.get("time_msc")),
                "dayOpen": day_open,
                "publishedAt": utc_now_iso(),
            },
            "publishedAt": utc_now_iso(),
        }
    except Exception as exc:
        return {**base_payload, "status": "mt5_tick_exception", "error": str(exc)}


def query_mt5_market_status_live(symbol: str, stale_seconds: int = 120) -> dict[str, Any]:
    published_at = utc_now_iso()
    stale_seconds = max(60, min(int(stale_seconds or 120), 3600))
    base_payload = {
        "ok": False,
        "status": "mt5_market_status_failed",
        "symbol": symbol,
        "marketStatus": None,
        "publishedAt": published_at,
    }

    if not symbol:
        return {**base_payload, "status": "bad_request", "error": "symbol_required"}

    try:
        import MetaTrader5 as mt5
    except ImportError as exc:
        return {**base_payload, "status": "mt5_market_status_unavailable", "error": str(exc)}

    try:
        if not mt5.initialize():
            return {
                **base_payload,
                "status": "mt5_market_status_init_failed",
                "error": "mt5_initialize_failed",
                "mt5LastError": mt5.last_error(),
            }

        if not mt5.symbol_select(symbol, True):
            return {
                **base_payload,
                "status": "mt5_market_status_symbol_select_failed",
                "error": "mt5_symbol_select_failed",
                "mt5LastError": mt5.last_error(),
            }

        symbol_info = mt5.symbol_info(symbol)
        trade_mode = safe_int(namedtuple_to_dict(symbol_info).get("trade_mode")) if symbol_info is not None else None
        tick = mt5.symbol_info_tick(symbol)
        tick_raw = namedtuple_to_dict(tick)
        tick_time = safe_int(tick_raw.get("time"))
        tick_time_msc = safe_int(tick_raw.get("time_msc"))
        rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, 1)
        rows = [item for row in mt5_rates_to_rows(rates) if (item := mt5_rate_row(row)) is not None]

        server_time = int(datetime.now(timezone.utc).timestamp())
        last_m1_time = safe_int(rows[-1].get("time")) if rows else None
        age_seconds = server_time - last_m1_time if last_m1_time is not None else None
        tick_age_seconds = server_time - tick_time if tick_time is not None else None
        is_disabled = trade_mode == 0
        is_m1_synced = age_seconds is not None and -60 <= age_seconds <= stale_seconds
        is_tick_synced = tick_age_seconds is not None and -60 <= tick_age_seconds <= stale_seconds
        status_value = "open" if (is_m1_synced or is_tick_synced) and not is_disabled else "closed"
        if is_disabled:
            reason = "trade_mode_disabled"
        elif is_m1_synced:
            reason = "m1_synced"
        elif is_tick_synced:
            reason = "tick_synced"
        elif rows:
            reason = "m1_and_tick_stale"
        else:
            reason = "no_m1_data"

        last_m1_iso = (
            datetime.fromtimestamp(last_m1_time, tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
            if last_m1_time is not None
            else None
        )
        return {
            "ok": True,
            "status": "mt5_market_status_ready",
            "symbol": symbol,
            "marketStatus": {
                "status": status_value,
                "label": "\u5f00\u5e02" if status_value == "open" else "\u4f11\u5e02",
                "lastM1Time": last_m1_time,
                "lastM1TimeMsc": last_m1_time * 1000 if last_m1_time is not None else None,
                "lastM1Iso": last_m1_iso,
                "lastTickTime": tick_time,
                "lastTickTimeMsc": tick_time_msc,
                "serverTime": server_time,
                "serverTimeIso": datetime.fromtimestamp(server_time, tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                "ageSeconds": age_seconds,
                "tickAgeSeconds": tick_age_seconds,
                "staleSeconds": stale_seconds,
                "tradeMode": trade_mode,
                "reason": reason,
            },
            "publishedAt": utc_now_iso(),
        }
    except Exception as exc:
        return {**base_payload, "status": "mt5_market_status_exception", "error": str(exc)}

def query_mt5_rates_live(symbol: str, timeframe: str, limit: int, time_from: int | None = None, time_to: int | None = None) -> dict[str, Any]:
    published_at = utc_now_iso()
    normalized_timeframe = normalize_timeframe(timeframe)
    base_payload = {
        "ok": False,
        "status": "mt5_rates_failed",
        "symbol": symbol,
        "timeframe": normalized_timeframe,
        "mode": "mt5_live",
        "rows": [],
        "publishedAt": published_at,
    }

    if not symbol:
        return {**base_payload, "status": "bad_request", "error": "symbol_required"}

    try:
        import MetaTrader5 as mt5
    except ImportError as exc:
        return {**base_payload, "status": "mt5_rates_unavailable", "error": str(exc)}

    timeframe_name = MT5_TIMEFRAME_NAMES.get(normalized_timeframe)
    mt5_timeframe = getattr(mt5, timeframe_name, None) if timeframe_name else None
    if mt5_timeframe is None:
        return {**base_payload, "status": "unsupported_timeframe", "error": normalized_timeframe}

    initialized = False
    try:
        if not mt5.initialize():
            return {
                **base_payload,
                "status": "mt5_rates_init_failed",
                "error": "mt5_initialize_failed",
                "mt5LastError": mt5.last_error(),
            }
        initialized = True

        if not mt5.symbol_select(symbol, True):
            return {
                **base_payload,
                "status": "mt5_rates_symbol_select_failed",
                "error": "mt5_symbol_select_failed",
                "mt5LastError": mt5.last_error(),
            }

        if time_from is not None and time_to is not None:
            rates = mt5.copy_rates_range(
                symbol,
                mt5_timeframe,
                datetime.fromtimestamp(int(time_from), tz=timezone.utc),
                datetime.fromtimestamp(int(time_to), tz=timezone.utc),
            )
        elif time_to is not None:
            rates = mt5.copy_rates_from(
                symbol,
                mt5_timeframe,
                datetime.fromtimestamp(int(time_to), tz=timezone.utc),
                int(limit),
            )
        else:
            rates = mt5.copy_rates_from_pos(symbol, mt5_timeframe, 0, int(limit))

        rows = [item for row in mt5_rates_to_rows(rates) if (item := mt5_rate_row(row)) is not None]
        if time_from is not None:
            rows = [row for row in rows if int(row["time"]) >= int(time_from)]
        if time_to is not None:
            rows = [row for row in rows if int(row["time"]) <= int(time_to)]
        rows = sorted(rows, key=lambda item: int(item["time"]))[-int(limit):]
        return {
            "ok": True,
            "status": "mt5_rates_ready",
            "symbol": symbol,
            "timeframe": normalized_timeframe,
            "mode": "mt5_live",
            "rows": rows,
            "count": len(rows),
            "publishedAt": utc_now_iso(),
        }
    except Exception as exc:
        return {**base_payload, "status": "mt5_rates_exception", "error": str(exc)}
    finally:
        # Do not shutdown MT5 here. The Python MT5 binding uses a process-wide
        # terminal session; closing it after a rates query interrupts active
        # chart tick streams.
        pass


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
