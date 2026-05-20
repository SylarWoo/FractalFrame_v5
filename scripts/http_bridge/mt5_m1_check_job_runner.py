from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any

from .mt5_m1_check_job_state import _get_m1_check_job, _set_m1_check_job
from .mt5_m1_check_payloads import _build_incremental_m1_check_payload, _build_m1_check_payload
from .mt5_m1_rows import mt5_rates_to_rows, mt5_row_to_m1_check_row
from .store_v5_status_service import format_utc_text, utc_now_iso


def run_mt5_m1_staged_check_job(
    job_id: str,
    symbol: str,
    *,
    chunk: int,
    max_count: int,
    pause_ms: int,
    mode: str = "refresh",
    since_time: int | None = None,
    base_first_time: int | None = None,
    base_last_time: int | None = None,
    base_true_m1_rows_count: int = 0,
    base_mt5_rows_count: int = 0,
    overlap_bars: int = 1000,
) -> None:
    from python.data_warehouse.mt5.mt5_m1_integrity_validator_v1 import validate_incremental_true_m1_rows_v1, validate_true_m1_rows_v1

    published_at = utc_now_iso()
    raw_rows: list[dict[str, Any]] = []
    initialized = False
    try:
        import MetaTrader5 as mt5

        if not mt5.initialize():
            _set_m1_check_job(
                job_id,
                ok=False,
                phase="failed",
                status="mt5_m1_check_init_failed",
                error="mt5_initialize_failed",
                mt5LastError=mt5.last_error(),
                finishedAt=utc_now_iso(),
            )
            return
        initialized = True

        if not mt5.symbol_select(symbol, True):
            _set_m1_check_job(
                job_id,
                ok=False,
                phase="failed",
                status="mt5_m1_check_symbol_select_failed",
                error="mt5_symbol_select_failed",
                mt5LastError=mt5.last_error(),
                finishedAt=utc_now_iso(),
            )
            return

        if mode == "incremental" and since_time is not None:
            from_time = datetime.fromtimestamp(int(since_time) - max(0, int(overlap_bars)) * 60, tz=timezone.utc)
            to_time = datetime.now(timezone.utc) + timedelta(minutes=1)
            _set_m1_check_job(
                job_id,
                ok=True,
                phase="fetching",
                status="mt5_m1_incremental_check_fetching",
                currentAction="copy_rates_range",
                chunkSize=chunk,
                maxCount=None,
                firstTimeText=format_utc_text(int(from_time.timestamp())),
                lastTimeText=format_utc_text(int(to_time.timestamp())),
            )
            rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_M1, from_time, to_time)
            raw_rows = mt5_rates_to_rows(rates)
            _set_m1_check_job(job_id, phase="validating", status="mt5_m1_incremental_check_validating", mt5RowsCount=len(raw_rows))
            canonical_rows = [
                mt5_row_to_m1_check_row(row, symbol=symbol, ingested_at=published_at)
                for row in raw_rows
            ]
            validation = validate_incremental_true_m1_rows_v1(
                canonical_rows,
                last_true_m1_time=int(since_time),
                overlap_bars=int(overlap_bars),
            )
            payload = _build_incremental_m1_check_payload(
                symbol=symbol,
                raw_rows=raw_rows,
                validation=validation,
                published_at=published_at,
                base={
                    "firstTime": base_first_time,
                    "lastTime": base_last_time or since_time,
                    "trueM1RowsCount": base_true_m1_rows_count,
                    "mt5RowsCount": base_mt5_rows_count,
                },
                staged={
                    "jobId": job_id,
                    "mode": "incremental",
                    "overlapBars": overlap_bars,
                    "sinceTime": since_time,
                    "rangeRowsCount": len(raw_rows),
                },
            )
            _set_m1_check_job(
                job_id,
                ok=payload.get("ok"),
                phase="completed" if payload.get("ok") else "failed",
                status=payload.get("status"),
                progressPercent=100,
                mt5RowsCount=len(raw_rows),
                result=payload,
                finishedAt=utc_now_iso(),
            )
            return

        pos = 0
        chunk_index = 0
        while pos < max_count:
            job = _get_m1_check_job(job_id)
            if job and job.get("cancelRequested"):
                _set_m1_check_job(job_id, ok=False, phase="cancelled", status="mt5_m1_check_cancelled", finishedAt=utc_now_iso())
                return

            want = min(chunk, max_count - pos)
            _set_m1_check_job(
                job_id,
                ok=True,
                phase="fetching",
                status="mt5_m1_check_fetching",
                currentAction="copy_rates_from_pos",
                chunksCompleted=chunk_index,
                currentBatchIndex=chunk_index + 1,
                currentBatchRequested=want,
                currentBatchFetched=0,
                mt5RowsCount=len(raw_rows),
                currentPosition=pos,
                maxCount=max_count,
                chunkSize=chunk,
                progressPercent=round(min(99, (pos / max_count) * 100), 2) if max_count else None,
            )
            rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, pos, want)
            part = mt5_rates_to_rows(rates)
            if not part:
                break
            raw_rows.extend(part)
            chunk_index += 1
            pos += len(part)

            first_time = raw_rows[0].get("time") if raw_rows else None
            last_time = raw_rows[-1].get("time") if raw_rows else None
            _set_m1_check_job(
                job_id,
                ok=True,
                phase="fetching",
                status="mt5_m1_check_fetching",
                chunksCompleted=chunk_index,
                mt5RowsCount=len(raw_rows),
                currentPosition=pos,
                maxCount=max_count,
                chunkSize=chunk,
                currentBatchIndex=chunk_index,
                currentBatchRequested=want,
                currentBatchFetched=len(part),
                firstTime=first_time,
                lastTime=last_time,
                firstTimeText=format_utc_text(first_time),
                lastTimeText=format_utc_text(last_time),
                progressPercent=round(min(99, (pos / max_count) * 100), 2) if max_count else None,
            )
            if len(part) < want:
                break
            if pause_ms > 0:
                time.sleep(pause_ms / 1000)

        _set_m1_check_job(job_id, phase="validating", status="mt5_m1_check_validating", mt5RowsCount=len(raw_rows))
        canonical_rows = [
            mt5_row_to_m1_check_row(row, symbol=symbol, ingested_at=published_at)
            for row in raw_rows
        ]
        validation = validate_true_m1_rows_v1(canonical_rows)
        payload = _build_m1_check_payload(
            symbol=symbol,
            raw_rows=raw_rows,
            validation=validation,
            published_at=published_at,
            staged={
                "jobId": job_id,
                "chunksCompleted": chunk_index,
                "chunkSize": chunk,
                "maxCount": max_count,
                "exhausted": len(raw_rows) < max_count,
            },
        )
        _set_m1_check_job(
            job_id,
            ok=payload.get("ok"),
            phase="completed",
            status=payload.get("status"),
            progressPercent=100,
            mt5RowsCount=len(raw_rows),
            result=payload,
            finishedAt=utc_now_iso(),
        )
    except ImportError as exc:
        _set_m1_check_job(job_id, ok=False, phase="failed", status="mt5_m1_check_unavailable", error=str(exc), finishedAt=utc_now_iso())
    except Exception as exc:
        _set_m1_check_job(job_id, ok=False, phase="failed", status="mt5_m1_check_exception", error=str(exc), finishedAt=utc_now_iso())
    finally:
        if initialized:
            try:
                mt5.shutdown()
            except Exception:
                pass
