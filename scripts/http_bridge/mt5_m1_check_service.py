from __future__ import annotations

import threading
import uuid
from typing import Any

from .jobs import M1_CHECK_JOB_TERMINAL_PHASES
from .mt5_m1_check_job_state import M1_CHECK_JOB_STORE, _get_m1_check_job
from .mt5_m1_check_payloads import _build_m1_check_payload
from .mt5_m1_rows import mt5_rates_to_rows, mt5_row_to_m1_check_row
from .mt5_m1_check_job_runner import run_mt5_m1_staged_check_job
from .store_v5_status_service import utc_now_iso


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
    M1_CHECK_JOB_STORE.prune_terminal(M1_CHECK_JOB_TERMINAL_PHASES)
    M1_CHECK_JOB_STORE.create(job_id, {
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
    })
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
