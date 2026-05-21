from __future__ import annotations

import json
import time
from typing import Any, Callable

from .jobs import AGGREGATE_JOBS, AGGREGATE_JOBS_CONDITION, AGGREGATE_JOB_TERMINAL_PHASES, PULL_JOBS, PULL_JOBS_CONDITION, PULL_JOB_TERMINAL_PHASES
from .response import start_sse


def send_mt5_tick_events(
    handler: Any,
    symbols: list[str],
    interval_ms: int,
    *,
    utc_now_iso: Callable[[], str],
    mt5_tick_to_payload: Callable[[Any, str, float | None], dict[str, Any] | None],
    resolve_mt5_day_open: Callable[[Any, str], float | None],
) -> None:
    start_sse(handler)

    try:
        import MetaTrader5 as mt5
    except ImportError as exc:
        handler.write_sse_event(1, "error", {
            "ok": False,
            "status": "mt5_realtime_unavailable",
            "error": str(exc),
            "symbols": symbols,
            "publishedAt": utc_now_iso(),
        })
        return

    initialized = False
    event_id = 1
    try:
        if not mt5.initialize():
            handler.write_sse_event(event_id, "error", {
                "ok": False,
                "status": "mt5_realtime_init_failed",
                "error": "mt5_initialize_failed",
                "mt5LastError": mt5.last_error(),
                "symbols": symbols,
                "publishedAt": utc_now_iso(),
            })
            return
        initialized = True

        selected_symbols: list[str] = []
        day_open_by_symbol: dict[str, float | None] = {}
        for symbol in symbols:
            if mt5.symbol_select(symbol, True):
                selected_symbols.append(symbol)
                day_open_by_symbol[symbol] = resolve_mt5_day_open(mt5, symbol)

        if not selected_symbols:
            handler.write_sse_event(event_id, "error", {
                "ok": False,
                "status": "mt5_realtime_symbol_select_failed",
                "error": "all_symbol_select_failed",
                "symbols": symbols,
                "mt5LastError": mt5.last_error(),
                "publishedAt": utc_now_iso(),
            })
            return

        handler.write_sse_event(event_id, "ready", {
            "ok": True,
            "status": "mt5_realtime_ready",
            "symbols": selected_symbols,
            "intervalMs": interval_ms,
            "publishedAt": utc_now_iso(),
        })

        sleep_seconds = interval_ms / 1000
        while True:
            event_id += 1
            ticks = [
                payload
                for symbol in selected_symbols
                if (payload := mt5_tick_to_payload(mt5, symbol, day_open_by_symbol.get(symbol))) is not None
            ]
            handler.write_sse_event(event_id, "ticks", {
                "ok": True,
                "status": "mt5_realtime_ticks",
                "symbols": selected_symbols,
                "ticks": ticks,
                "publishedAt": utc_now_iso(),
            })
            time.sleep(sleep_seconds)
    except (BrokenPipeError, ConnectionResetError, OSError):
        return
    except Exception as exc:
        try:
            handler.write_sse_event(event_id + 1, "error", {
                "ok": False,
                "status": "mt5_realtime_exception",
                "error": str(exc),
                "symbols": symbols,
                "publishedAt": utc_now_iso(),
            })
        except (BrokenPipeError, ConnectionResetError, OSError):
            return
    finally:
        # Keep the MT5 terminal session alive for other realtime/rates requests.
        # MetaTrader5.initialize/shutdown is process-wide, so shutting down one
        # SSE connection can break another chart's live feed.
        pass


def send_pull_job_events(handler: Any, job_id: str, *, utc_now_iso: Callable[[], str]) -> None:
    send_job_events(
        handler,
        job_id,
        jobs=PULL_JOBS,
        condition=PULL_JOBS_CONDITION,
        terminal_phases=PULL_JOB_TERMINAL_PHASES,
        utc_now_iso=utc_now_iso,
    )


def send_aggregate_job_events(handler: Any, job_id: str, *, utc_now_iso: Callable[[], str]) -> None:
    send_job_events(
        handler,
        job_id,
        jobs=AGGREGATE_JOBS,
        condition=AGGREGATE_JOBS_CONDITION,
        terminal_phases=AGGREGATE_JOB_TERMINAL_PHASES,
        utc_now_iso=utc_now_iso,
    )


def send_job_events(
    handler: Any,
    job_id: str,
    *,
    jobs: dict[str, dict[str, Any]],
    condition: Any,
    terminal_phases: set[str],
    utc_now_iso: Callable[[], str],
) -> None:
    start_sse(handler)

    last_sent = 0
    while True:
        with condition:
            job = jobs.get(job_id)
            if not job:
                events = [{
                    "id": last_sent + 1,
                    "event": "error",
                    "data": {"ok": False, "jobId": job_id, "phase": "failed", "status": "job_not_found", "error": "job_not_found"},
                }]
            else:
                condition.wait_for(
                    lambda: any(int(event.get("id") or 0) > last_sent for event in job.get("events", []))
                    or str(job.get("phase") or "") in terminal_phases,
                    timeout=15,
                )
                events = [
                    event for event in job.get("events", [])
                    if int(event.get("id") or 0) > last_sent
                ]
                if not events:
                    events = [{"id": last_sent, "event": "ping", "data": {"ok": True, "jobId": job_id, "phase": job.get("phase"), "updatedAt": utc_now_iso()}}]

        should_close = False
        for event in events:
            event_id = int(event.get("id") or last_sent)
            event_name = str(event.get("event") or "progress")
            data = event.get("data") if isinstance(event.get("data"), dict) else {}
            if event_id > last_sent:
                last_sent = event_id
            if event_name in {"done", "error", "cancelled"}:
                should_close = True
            try:
                handler.wfile.write(f"id: {event_id}\n".encode("utf-8"))
                handler.wfile.write(f"event: {event_name}\n".encode("utf-8"))
                handler.wfile.write(f"data: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8"))
                handler.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, OSError):
                return
        if should_close:
            return
