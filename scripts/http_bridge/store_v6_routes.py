from __future__ import annotations

from typing import Any
from urllib.parse import ParseResult, parse_qs

from .query_params import clamp_m1_check_count, query_bool
from .response import error_payload
from .route_helpers import parse_timeframes, required_job_id, required_symbol

AGGREGATE_TIMEFRAMES_DEFAULT = "M5,M15,M30,H1,H4,D1,W1,MN"


def _parse_store_v6_timeframes(value: str) -> list[str]:
    return ["MN" if item == "MN1" else item for item in parse_timeframes(value)]


def handle_store_v6_post(handler: Any, parsed: ParseResult, services: Any) -> bool:
    if parsed.path == "/api/market-data/v1/store-v6/direct-m1/clean":
        handler.send_json(501, error_payload("store_v6_maintenance_not_supported", "StoreV6 raw-to-clean is handled by the pull pipeline."))
        return True
    return False


def handle_store_v6_get(handler: Any, parsed: ParseResult, services: Any) -> bool:
    if parsed.path == "/api/market-data/v1/store-v6/symbols":
        try:
            handler.send_json(200, services.list_store_v6_symbols(store_root=handler.store_v6_root()))
        except Exception as exc:
            handler.send_json(500, error_payload("store_v6_symbols_failed", str(exc)))
        return True

    if parsed.path == "/api/market-data/v1/store-v6/status":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        if not symbol:
            handler.send_json(400, error_payload("bad_request", "symbol_required"))
            return True
        handler.send_json(200, services.check_store_v6(symbol, store_root=handler.store_v6_root()))
        return True

    if parsed.path == "/api/market-data/v1/store-v6/daily-maintenance/status":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query) or None
        handler.send_json(200, services.daily_maintenance_status(symbol, store_root=handler.store_v6_root()))
        return True

    if parsed.path == "/api/market-data/v1/store-v6/daily-maintenance/events":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query) or None
        limit = clamp_m1_check_count((query.get("limit") or ["200"])[0], default=200)
        handler.send_json(200, services.daily_maintenance_events(symbol, store_root=handler.store_v6_root(), limit=limit))
        return True

    if parsed.path == "/api/market-data/v1/store-v6/daily-maintenance/start":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        trigger = (query.get("trigger") or ["manual"])[0].strip().lower() or "manual"
        if not symbol:
            handler.send_json(400, error_payload("bad_request", "symbol_required"))
            return True
        handler.send_json(202, services.start_store_v6_daily_maintenance(symbol, trigger=trigger, store_root=handler.store_v6_root()))
        return True

    if parsed.path == "/api/market-data/v1/store-v6/delete":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        if not symbol:
            handler.send_json(400, error_payload("bad_request", "symbol_required"))
            return True
        try:
            payload = services.delete_store_v6_symbol(symbol, store_root=handler.store_v6_root())
            handler.send_json(200 if payload.get("ok") is True else 400, payload)
        except Exception as exc:
            handler.send_json(500, error_payload("store_v6_delete_failed", str(exc)))
        return True

    if parsed.path == "/api/market-data/v1/store-v6/aggregated/delete":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        timeframes = _parse_store_v6_timeframes((query.get("timeframes") or [""])[0])
        if not symbol:
            handler.send_json(400, error_payload("bad_request", "symbol_required"))
            return True
        if not timeframes:
            handler.send_json(400, error_payload("bad_request", "timeframes_required"))
            return True
        try:
            payload = services.delete_store_v6_aggregated_timeframes(symbol, timeframes=timeframes, store_root=handler.store_v6_root())
            handler.send_json(200 if payload.get("ok") is True else 400, payload)
        except Exception as exc:
            handler.send_json(500, error_payload("store_v6_aggregated_delete_failed", str(exc)))
        return True

    if parsed.path in {"/api/market-data/v1/store-v6/direct-m1/clean", "/api/market-data/v1/store-v6/m1/repair-gaps"}:
        handler.send_json(501, error_payload("store_v6_maintenance_not_supported", "StoreV6 raw-to-clean and gap repair are handled by the pull/audit pipeline."))
        return True

    if parsed.path == "/api/market-data/v1/store-v6/query":
        try:
            handler.send_json(200, services.query_store_v6_ohlcv(parse_qs(parsed.query), store_root=handler.store_v6_root()))
        except Exception as exc:
            handler.send_json(500, error_payload("store_v6_query_failed", str(exc)))
        return True

    if parsed.path == "/api/market-data/v1/store-v6/index-times":
        try:
            handler.send_json(200, services.query_store_v6_index_times(parse_qs(parsed.query), store_root=handler.store_v6_root()))
        except Exception as exc:
            handler.send_json(500, error_payload("store_v6_index_times_failed", str(exc)))
        return True

    if parsed.path == "/api/market-data/v1/store-v6/audit":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        repair = query_bool((query.get("repair") or ["0"])[0], default=False)
        if not symbol:
            handler.send_json(400, error_payload("bad_request", "symbol_required"))
            return True
        try:
            handler.send_json(200, services.audit_store_v6(symbol, repair=repair, store_root=handler.store_v6_root()))
        except Exception as exc:
            handler.send_json(500, error_payload("store_v6_audit_failed", str(exc)))
        return True

    if parsed.path == "/api/market-data/v1/store-v6/aggregate":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        timeframes = _parse_store_v6_timeframes((query.get("timeframes") or [AGGREGATE_TIMEFRAMES_DEFAULT])[0])
        rebuild = query_bool((query.get("rebuild") or ["1"])[0], default=True)
        if not symbol:
            handler.send_json(400, error_payload("bad_request", "symbol_required"))
            return True
        payload = services.aggregate_store_v6(symbol, timeframes=timeframes, rebuild=rebuild, store_root=handler.store_v6_root())
        handler.send_json(200 if payload.get("ok") is True else 400, payload)
        return True

    if parsed.path == "/api/market-data/v1/store-v6/pull":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        mode = (query.get("mode") or ["incremental"])[0].strip().lower()
        count_text = (query.get("count") or [None])[0]
        count = None if mode == "refresh" and count_text in {None, ""} else clamp_m1_check_count(count_text, default=10_000_000)
        if not symbol:
            handler.send_json(400, error_payload("bad_request", "symbol_required"))
            return True
        if mode not in {"refresh", "incremental"}:
            handler.send_json(400, error_payload("bad_request", "unsupported_import_mode"))
            return True
        try:
            payload = services.pull_store_v6(symbol, mode=mode, count=count, store_root=handler.store_v6_root())
            handler.send_json(200 if payload.get("ok") is True else 400, payload)
        except Exception as exc:
            handler.send_json(500, error_payload("store_v6_pull_failed", str(exc)))
        return True

    if parsed.path == "/api/market-data/v1/store-v6/pull/start":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        mode = (query.get("mode") or ["incremental"])[0].strip().lower()
        count_text = (query.get("count") or [None])[0]
        count = None if mode == "refresh" and count_text in {None, ""} else clamp_m1_check_count(count_text, default=10_000_000)
        if not symbol:
            handler.send_json(400, error_payload("bad_request", "symbol_required"))
            return True
        if mode not in {"refresh", "incremental"}:
            handler.send_json(400, error_payload("bad_request", "unsupported_import_mode"))
            return True
        handler.send_json(202, services.start_store_v6_pull_job(symbol, mode=mode, count=count, store_root=handler.store_v6_root()))
        return True

    if parsed.path == "/api/market-data/v1/store-v6/pull/progress":
        return _send_job(handler, parse_qs(parsed.query), services._get_store_v6_pull_job)

    if parsed.path == "/api/market-data/v1/store-v6/pull/events":
        query = parse_qs(parsed.query)
        job_id = required_job_id(query)
        if not job_id:
            handler.send_json(400, error_payload("bad_request", "job_id_required"))
            return True
        if not services._get_store_v6_pull_job(job_id):
            handler.send_json(404, error_payload("job_not_found", "job_not_found", jobId=job_id))
            return True
        handler.send_store_v6_pull_job_events(job_id)
        return True

    if parsed.path == "/api/market-data/v1/store-v6/pull/cancel":
        return _cancel_job(handler, parse_qs(parsed.query), services._set_store_v6_pull_job, "store_v6_pull_cancel_requested")

    if parsed.path == "/api/market-data/v1/store-v6/aggregate/start":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        timeframes = _parse_store_v6_timeframes((query.get("timeframes") or [AGGREGATE_TIMEFRAMES_DEFAULT])[0])
        rebuild = query_bool((query.get("rebuild") or ["0"])[0], default=False)
        if not symbol:
            handler.send_json(400, error_payload("bad_request", "symbol_required"))
            return True
        handler.send_json(202, services.start_store_v6_aggregate_job(symbol, timeframes=timeframes, rebuild=rebuild, store_root=handler.store_v6_root()))
        return True

    if parsed.path == "/api/market-data/v1/store-v6/aggregate/progress":
        return _send_job(handler, parse_qs(parsed.query), services._get_aggregate_job_v6)

    if parsed.path == "/api/market-data/v1/store-v6/aggregate/events":
        query = parse_qs(parsed.query)
        job_id = required_job_id(query)
        if not job_id:
            handler.send_json(400, error_payload("bad_request", "job_id_required"))
            return True
        if not services._get_aggregate_job_v6(job_id):
            handler.send_json(404, error_payload("job_not_found", "job_not_found", jobId=job_id))
            return True
        handler.send_store_v6_aggregate_job_events(job_id)
        return True

    if parsed.path == "/api/market-data/v1/store-v6/aggregate/cancel":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        if symbol:
            handler.send_json(200, services.cancel_store_v6_aggregate_jobs_for_symbol(symbol))
            return True
        return _cancel_job(handler, query, services._set_aggregate_job_v6, "store_v6_aggregate_cancel_requested")

    return False


def _send_job(handler: Any, query: dict[str, list[str]], get_job: Any) -> bool:
    job_id = required_job_id(query)
    if not job_id:
        handler.send_json(400, error_payload("bad_request", "job_id_required"))
        return True
    job = get_job(job_id)
    if not job:
        handler.send_json(404, error_payload("job_not_found", "job_not_found", jobId=job_id))
        return True
    handler.send_json(200, job)
    return True


def _cancel_job(handler: Any, query: dict[str, list[str]], set_job: Any, status: str) -> bool:
    job_id = required_job_id(query)
    if not job_id:
        handler.send_json(400, error_payload("bad_request", "job_id_required"))
        return True
    job = set_job(job_id, cancelRequested=True, status=status)
    if not job:
        handler.send_json(404, error_payload("job_not_found", "job_not_found", jobId=job_id))
        return True
    handler.send_json(200, job)
    return True
