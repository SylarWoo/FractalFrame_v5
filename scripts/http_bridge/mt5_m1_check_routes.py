from __future__ import annotations

from typing import Any
from urllib.parse import ParseResult, parse_qs

from .query_params import clamp_m1_check_chunk, clamp_m1_check_count, safe_query_int
from .route_helpers import required_job_id, required_symbol


def handle_mt5_m1_check_get(handler: Any, parsed: ParseResult, services: Any) -> bool:
    if parsed.path == "/api/market-data/v1/mt5/m1/check/start":
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        mode = (query.get("mode") or ["refresh"])[0].strip().lower()
        chunk = clamp_m1_check_chunk((query.get("chunk") or [None])[0], default=200_000)
        max_count = clamp_m1_check_count((query.get("maxCount") or query.get("max_count") or [None])[0], default=10_000_000)
        pause_ms = max(0, min(safe_query_int((query.get("pauseMs") or query.get("pause_ms") or [None])[0], 50) or 0, 5_000))
        since_time = safe_query_int((query.get("sinceTime") or query.get("since_time") or [None])[0], None)
        base_first_time = safe_query_int((query.get("baseFirstTime") or query.get("base_first_time") or [None])[0], None)
        base_last_time = safe_query_int((query.get("baseLastTime") or query.get("base_last_time") or [None])[0], None)
        base_true_m1_rows_count = safe_query_int((query.get("baseTrueM1RowsCount") or query.get("base_true_m1_rows_count") or [None])[0], 0) or 0
        base_mt5_rows_count = safe_query_int((query.get("baseMt5RowsCount") or query.get("base_mt5_rows_count") or [None])[0], 0) or 0
        base_gap_count = safe_query_int((query.get("baseGapCount") or query.get("base_gap_count") or [None])[0], None)
        overlap_bars = safe_query_int((query.get("overlapBars") or query.get("overlap_bars") or [None])[0], 1000) or 1000
        if not symbol:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
            return True
        if mode not in {"refresh", "incremental"}:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "unsupported_check_mode"})
            return True
        if mode == "incremental" and since_time is None:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "since_time_required"})
            return True
        handler.send_json(
            202,
            services.start_mt5_m1_staged_check(
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
                base_gap_count=base_gap_count,
                overlap_bars=overlap_bars,
            ),
        )
        return True

    if parsed.path == "/api/market-data/v1/mt5/m1/check/progress":
        query = parse_qs(parsed.query)
        job_id = required_job_id(query)
        if not job_id:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "job_id_required"})
            return True
        job = services._get_m1_check_job(job_id)
        if not job:
            handler.send_json(404, {"ok": False, "status": "job_not_found", "error": "job_not_found", "jobId": job_id})
            return True
        handler.send_json(200, job)
        return True

    if parsed.path == "/api/market-data/v1/mt5/m1/check/cancel":
        query = parse_qs(parsed.query)
        job_id = required_job_id(query)
        if not job_id:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "job_id_required"})
            return True
        job = services._set_m1_check_job(job_id, cancelRequested=True, status="mt5_m1_check_cancel_requested")
        if not job:
            handler.send_json(404, {"ok": False, "status": "job_not_found", "error": "job_not_found", "jobId": job_id})
            return True
        handler.send_json(200, job)
        return True

    if parsed.path in {"/api/market-data/v1/mt5/m1/check", "/api/market-data/v1/store-v5/check"}:
        query = parse_qs(parsed.query)
        symbol = required_symbol(query)
        count = clamp_m1_check_count((query.get("count") or [None])[0], default=200_000)
        if not symbol:
            handler.send_json(400, {"ok": False, "status": "bad_request", "error": "symbol_required"})
            return True
        try:
            payload = services.check_mt5_m1_live(symbol, count=count)
            handler.send_json(200, payload)
        except Exception as exc:
            handler.send_json(500, {"ok": False, "status": "mt5_m1_check_failed", "error": str(exc)})
        return True

    return False
