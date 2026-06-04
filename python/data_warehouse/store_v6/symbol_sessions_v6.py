from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .paths_v6 import ensure_store_layout

_LOCK = threading.RLock()
DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sessions_dir(store_root: str | Path | None = None) -> Path:
    return ensure_store_layout(store_root) / "sessions"


def session_symbols_dir(store_root: str | Path | None = None) -> Path:
    path = sessions_dir(store_root) / "symbols"
    path.mkdir(parents=True, exist_ok=True)
    return path


def symbol_details_path(store_root: str | Path | None = None) -> Path:
    return sessions_dir(store_root) / "mt5_symbol_details.json"


def trading_rules_path(store_root: str | Path | None = None) -> Path:
    return sessions_dir(store_root) / "trading_session_rules.json"


def symbol_rule_path(symbol: str, store_root: str | Path | None = None) -> Path:
    safe_symbol = str(symbol).replace("/", "_").replace("\\", "_").replace(":", "_")
    return session_symbols_dir(store_root) / f"{safe_symbol}.session_rule.json"


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.{os.getpid()}.{threading.get_ident()}.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    tmp.replace(path)


def _read_json(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _parse_ranges(text: Any) -> list[dict[str, str]]:
    output: list[dict[str, str]] = []
    for part in str(text or "").split(","):
        item = part.strip()
        if not item or "-" not in item:
            continue
        start, end = item.split("-", 1)
        start = start.strip()[:5]
        end = end.strip()[:5]
        if start and end:
            output.append({"from": start, "to": end})
    return output


def _weekly_sessions(values: Any) -> dict[str, list[dict[str, str]]]:
    raw = values if isinstance(values, list) else []
    return {day: _parse_ranges(raw[index] if index < len(raw) else "") for index, day in enumerate(DAY_NAMES)}


def _default_anchor(symbol: str, row: dict[str, Any]) -> str:
    text = " ".join(str(row.get(key) or "") for key in ("symbol", "name", "description", "path", "category", "market")).lower()
    if "xau" in symbol.lower() or "gold" in text or "metal" in text:
        return "UTC2200"
    return "UTC0000"


def build_trading_session_rule(row: dict[str, Any], *, generated_at: str | None = None) -> dict[str, Any]:
    symbol = str(row.get("symbol") or "").strip()
    sessions = row.get("sessions") if isinstance(row.get("sessions"), dict) else {}
    quote_sessions = _weekly_sessions(sessions.get("quote") if isinstance(sessions, dict) else None)
    trade_sessions = _weekly_sessions(sessions.get("trade") if isinstance(sessions, dict) else None)
    session_source = str(row.get("sessionsSource") or "").strip()
    sources = [session_source] if session_source else []
    if not sources and any(trade_sessions.values()):
        sources = ["mt5_python"]
    if not sources:
        sources = ["symbol_scan"]
    generated = generated_at or utc_now_iso()
    return {
        "schemaVersion": 1,
        "storeVersion": "store_v6",
        "ruleId": f"{symbol}:session-rule:v1",
        "ruleVersion": 1,
        "symbol": symbol,
        "timezone": "UTC",
        "sessionAnchor": _default_anchor(symbol, row),
        "source": sources,
        "sessionsSource": row.get("sessionsSource"),
        "sessionsPath": row.get("sessionsPath"),
        "sessionsUpdatedAt": row.get("sessionsUpdatedAt"),
        "quoteSessions": quote_sessions,
        "tradeSessions": trade_sessions,
        "manualOverrides": [],
        "holidays": [],
        "updatedAt": generated,
        "symbolInfo": {key: value for key, value in row.items() if key not in {"sessions"}},
    }


def sync_symbol_sessions_v6(rows: list[dict[str, Any]], *, store_root: str | Path | None = None, generated_at: str | None = None) -> dict[str, Any]:
    generated = generated_at or utc_now_iso()
    clean_rows = [row for row in rows if isinstance(row, dict) and str(row.get("symbol") or "").strip()]
    rules: dict[str, Any] = {}
    with _LOCK:
        previous_details = _read_json(symbol_details_path(store_root)) or {}
        previous_symbols = previous_details.get("symbols") if isinstance(previous_details.get("symbols"), list) else []
        symbols_by_name = {str(row.get("symbol") or ""): row for row in previous_symbols if isinstance(row, dict) and row.get("symbol")}
        previous_rules = _read_json(trading_rules_path(store_root)) or {}
        rules = previous_rules.get("rules") if isinstance(previous_rules.get("rules"), dict) else {}
        rules = dict(rules)
        for row in clean_rows:
            rule = build_trading_session_rule(row, generated_at=generated)
            symbol = rule["symbol"]
            rules[symbol] = rule
            symbols_by_name[symbol] = row
            _write_json(symbol_rule_path(symbol, store_root), rule)

        merged_symbols = sorted(symbols_by_name.values(), key=lambda item: str(item.get("symbol") or "").lower())
        details_payload = {
            "ok": True,
            "schemaVersion": 1,
            "storeVersion": "store_v6",
            "source": "mt5_symbol_scan",
            "count": len(merged_symbols),
            "updatedAt": generated,
            "symbols": merged_symbols,
        }
        rules_payload = {
            "ok": True,
            "schemaVersion": 1,
            "storeVersion": "store_v6",
            "source": "mt5_symbol_scan",
            "count": len(rules),
            "updatedAt": generated,
            "rules": rules,
        }
        _write_json(symbol_details_path(store_root), details_payload)
        _write_json(trading_rules_path(store_root), rules_payload)
    return {
        "ok": True,
        "status": "store_v6_symbol_sessions_synced",
        "count": len(rules),
        "detailsPath": str(symbol_details_path(store_root)),
        "rulesPath": str(trading_rules_path(store_root)),
        "symbolsDir": str(session_symbols_dir(store_root)),
        "updatedAt": generated,
    }


def read_symbol_session_rule_v6(symbol: str, *, store_root: str | Path | None = None) -> dict[str, Any] | None:
    path = symbol_rule_path(symbol, store_root)
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _minutes(value: str) -> int | None:
    try:
        hour_text, minute_text = str(value).split(":", 1)
        return int(hour_text) * 60 + int(minute_text[:2])
    except Exception:
        return None


def _trading_day(open_time: int, anchor: str) -> str:
    dt = datetime.fromtimestamp(int(open_time), tz=timezone.utc)
    if anchor == "UTC2200":
        dt = dt - timedelta(hours=22)
    return dt.date().isoformat()


def _session_epoch(day_start: datetime, minutes_value: int) -> int:
    return int((day_start + timedelta(minutes=minutes_value)).timestamp())


def annotate_time_with_session_rule(symbol: str, open_time: int, rule: dict[str, Any] | None) -> dict[str, Any]:
    if not rule:
        return {
            "sessionRuleId": None,
            "sessionRuleVersion": None,
            "sessionId": None,
            "tradingDay": None,
            "sessionState": "unknown",
            "isTradingTime": None,
            "sessionOpenTime": None,
            "sessionCloseTime": None,
        }

    dt = datetime.fromtimestamp(int(open_time), tz=timezone.utc)
    day_name = DAY_NAMES[(dt.weekday() + 1) % 7]
    day_start = datetime(dt.year, dt.month, dt.day, tzinfo=timezone.utc)
    trade_sessions = rule.get("tradeSessions") if isinstance(rule.get("tradeSessions"), dict) else {}
    ranges = trade_sessions.get(day_name) if isinstance(trade_sessions, dict) else []
    minute_of_day = dt.hour * 60 + dt.minute
    state = "weekend" if day_name in {"sat", "sun"} and not ranges else "closed"
    session_open: int | None = None
    session_close: int | None = None
    for item in ranges if isinstance(ranges, list) else []:
        if not isinstance(item, dict):
            continue
        start = _minutes(str(item.get("from") or ""))
        end = _minutes(str(item.get("to") or ""))
        if start is None or end is None:
            continue
        normalized_end = end if end > start else end + 24 * 60
        current = minute_of_day if minute_of_day >= start else minute_of_day + 24 * 60
        if start <= current < normalized_end:
            state = "trading"
            session_open = _session_epoch(day_start, start)
            session_close = _session_epoch(day_start, normalized_end)
            break
    trading_day = _trading_day(int(open_time), str(rule.get("sessionAnchor") or "UTC0000"))
    return {
        "sessionRuleId": rule.get("ruleId"),
        "sessionRuleVersion": rule.get("ruleVersion"),
        "sessionId": f"{symbol}:{trading_day}" if state == "trading" else None,
        "tradingDay": trading_day,
        "sessionState": state,
        "isTradingTime": state == "trading",
        "sessionOpenTime": session_open,
        "sessionCloseTime": session_close,
    }
