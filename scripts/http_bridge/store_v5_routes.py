from __future__ import annotations

from typing import Any
from urllib.parse import ParseResult, parse_qs

from .query_params import clamp_m1_check_count, query_bool, safe_query_int
from .response import error_payload
from .route_helpers import parse_timeframes, required_job_id, required_symbol

AGGREGATE_TIMEFRAMES_DEFAULT = "M5,M15,M30,H1,H2,H3,H4,D1,W1,MN1"


def handle_store_v5_post(handler: Any, parsed: ParseResult, services: Any) -> bool:
    if parsed.path != "/api/market-data/v1/store-v5/direct-m1/clean":
        return False
    query = parse_qs(parsed.query)
    symbol = required_symbol(query)
    if not symbol:
        handler.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
        return True
    try:
        payload = services.clean_store_v5_direct_m1(symbol, store_root=handler.store_root)
        _send_payload_result(handler, payload)
    except Exception as exc:
        _send_exception(handler, "store_v5_clean_failed", exc)
    return True


def handle_store_v5_get(handler: Any, parsed: ParseResult, services: Any) -> bool:
    if parsed.path == "/api/market-data/v1/store-v5/status":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        if not symbol:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
            return True
        try:
            handler.send_json(200, services.check_store_v5(symbol, store_root=handler.store_root))
        except Exception as exc:
            _send_exception(handler, "store_v5_status_failed", exc)
        return True

    if parsed.path == "/api/market-data/v1/store-v5/m1/repair-gaps":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        lookback_minutes = safe_query_int((query.get("lookbackMinutes") or query.get("lookback_minutes") or [None])[0], 360) or 360
        max_gap_minutes = safe_query_int((query.get("maxGapMinutes") or query.get("max_gap_minutes") or [None])[0], 240) or 240
        if not symbol:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
            return True
        try:
            payload = services.repair_store_v5_m1_gaps(symbol, lookback_minutes=lookback_minutes, max_gap_minutes=max_gap_minutes, store_root=handler.store_root)
            _send_payload_result(handler, payload, failure_status=500)
        except Exception as exc:
            _send_exception(handler, "store_v5_m1_gap_repair_failed", exc)
        return True

    if parsed.path == "/api/market-data/v1/store-v5/delete":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        if not symbol:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
            return True
        try:
            payload = services.delete_store_v5_symbol(symbol, store_root=handler.store_root)
            _send_payload_result(handler, payload)
        except Exception as exc:
            _send_exception(handler, "store_v5_delete_failed", exc)
        return True

    if parsed.path == "/api/market-data/v1/store-v5/aggregated/delete":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        timeframes = parse_timeframes((query.get("timeframes") or [""])[0])
        if not symbol:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
            return True
        if not timeframes:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "timeframes_required"})
            return True
        try:
            payload = services.delete_store_v5_aggregated_timeframes(symbol, timeframes=timeframes, store_root=handler.store_root)
            _send_payload_result(handler, payload)
        except Exception as exc:
            _send_exception(handler, "store_v5_aggregated_delete_failed", exc)
        return True

    if parsed.path == "/api/market-data/v1/store-v5/pull/start":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        mode = (query.get("mode") or ["incremental"])[0].strip().lower()
        count_text = (query.get("count") or [None])[0]
        count = None if mode == "refresh" and count_text in {None, ""} else clamp_m1_check_count(count_text, default=10_000_000)
        if not symbol:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
            return True
        if mode not in {"refresh", "incremental"}:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "unsupported_import_mode"})
            return True
        handler.send_json(202, services.start_store_v5_pull_job(symbol, mode=mode, count=count, store_root=handler.store_root))
        return True

    if parsed.path == "/api/market-data/v1/store-v5/pull/progress":
        return _send_job(handler, parse_qs(parsed.query), services._get_pull_job)

    if parsed.path == "/api/market-data/v1/store-v5/pull/events":
        query = parse_qs(parsed.query)
        job_id = required_job_id(query)
        if not job_id:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "job_id_required"})
            return True
        if not services._get_pull_job(job_id):
            handler.send_json(404, {"ok": False, "status": "job_not_found", "error": "job_not_found", "jobId": job_id})
            return True
        handler.send_pull_job_events(job_id)
        return True

    if parsed.path == "/api/market-data/v1/store-v5/pull/cancel":
        return _cancel_job(handler, parse_qs(parsed.query), services._set_pull_job, "store_v5_pull_cancel_requested")

    if parsed.path == "/api/market-data/v1/store-v5/aggregate/start":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        timeframes = parse_timeframes((query.get("timeframes") or [AGGREGATE_TIMEFRAMES_DEFAULT])[0])
        rebuild = query_bool((query.get("rebuild") or ["0"])[0], default=False)
        if not symbol:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
            return True
        if not timeframes:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "timeframes_required"})
            return True
        handler.send_json(202, services.start_store_v5_aggregate_job(symbol, timeframes=timeframes, rebuild=rebuild, store_root=handler.store_root))
        return True

    if parsed.path == "/api/market-data/v1/store-v5/aggregate/progress":
        return _send_job(handler, parse_qs(parsed.query), services._get_aggregate_job)

    if parsed.path == "/api/market-data/v1/store-v5/aggregate/events":
        query = parse_qs(parsed.query)
        job_id = required_job_id(query)
        if not job_id:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "job_id_required"})
            return True
        if not services._get_aggregate_job(job_id):
            handler.send_json(404, {"ok": False, "status": "job_not_found", "error": "job_not_found", "jobId": job_id})
            return True
        handler.send_aggregate_job_events(job_id)
        return True

    if parsed.path == "/api/market-data/v1/store-v5/aggregate/cancel":
        return _cancel_job(handler, parse_qs(parsed.query), services._set_aggregate_job, "store_v5_aggregate_cancel_requested")

    if parsed.path == "/api/market-data/v1/store-v5/pull":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        mode = (query.get("mode") or ["incremental"])[0].strip().lower()
        count = clamp_m1_check_count((query.get("count") or [None])[0], default=10_000_000)
        if not symbol:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
            return True
        try:
            payload = services.pull_store_v5(symbol, mode=mode, count=count, store_root=handler.store_root)
            _send_payload_result(handler, payload)
        except Exception as exc:
            _send_exception(handler, "store_v5_pull_failed", exc)
        return True

    if parsed.path == "/api/market-data/v1/store-v5/direct-m1/clean":
        return handle_store_v5_post(handler, parsed, services)

    if parsed.path == "/api/market-data/v1/store-v5/aggregate":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        timeframes = parse_timeframes((query.get("timeframes") or [AGGREGATE_TIMEFRAMES_DEFAULT])[0])
        rebuild = query_bool((query.get("rebuild") or ["1"])[0], default=True)
        if not symbol:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
            return True
        try:
            payload = services.aggregate_store_v5(symbol, timeframes=timeframes, rebuild=rebuild, store_root=handler.store_root)
            _send_payload_result(handler, payload)
        except Exception as exc:
            _send_exception(handler, "store_v5_aggregate_failed", exc)
        return True

    if parsed.path == "/api/market-data/v1/store-v5/query":
        try:
            payload = services.query_store_v5_ohlcv(parse_qs(parsed.query), store_root=handler.store_root)
            handler.send_json(200, payload)
        except Exception as exc:
            _send_exception(handler, "store_v5_query_failed", exc)
        return True

    return False


def _send_payload_result(handler: Any, payload: dict[str, Any], *, success_status: int = 200, failure_status: int = 400) -> None:
    handler.send_json(success_status if payload.get("ok") is True else failure_status, payload)


def _send_exception(handler: Any, status: str, exc: Exception) -> None:
    handler.send_json(500, error_payload(status, str(exc)))


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
