from __future__ import annotations

import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from .jobs import M1_CHECK_JOBS, M1_CHECK_JOBS_LOCK
from .store_v5_status_service import format_utc_text, utc_now_iso


def mt5_rates_to_rows(rates: Any) -> list[dict[str, Any]]:
    if rates is None:
        return []
    rows: list[dict[str, Any]] = []
    for row in rates:
        if hasattr(row, "_asdict"):
            rows.append(dict(row._asdict()))
            continue
        if isinstance(row, dict):
            rows.append(dict(row))
            continue
        names = getattr(getattr(row, "dtype", None), "names", None)
        if names:
            rows.append({name: row[name].item() if hasattr(row[name], "item") else row[name] for name in names})
            continue
        rows.append(dict(row))
    return rows


def mt5_row_to_m1_check_row(row: dict[str, Any], symbol: str, ingested_at: str) -> dict[str, Any]:
    return {
        "time": int(row["time"]),
        "open": float(row["open"]),
        "high": float(row["high"]),
        "low": float(row["low"]),
        "close": float(row["close"]),
        "volume": int(row.get("tick_volume", row.get("volume", 0)) or 0),
        "provider": "mt5",
        "symbol": symbol,
        "timeframe": "M1",
        "source": "mt5_terminal",
        "ingestedAt": ingested_at,
    }


def _set_m1_check_job(job_id: str, **updates: Any) -> dict[str, Any]:
    with M1_CHECK_JOBS_LOCK:
        job = M1_CHECK_JOBS.get(job_id)
        if not job:
            return {}
        job.update(updates)
        job["updatedAt"] = utc_now_iso()
        return dict(job)


def _get_m1_check_job(job_id: str) -> dict[str, Any] | None:
    with M1_CHECK_JOBS_LOCK:
        job = M1_CHECK_JOBS.get(job_id)
        return dict(job) if job else None


def _build_m1_check_payload(
    *,
    symbol: str,
    raw_rows: list[dict[str, Any]],
    validation: dict[str, Any],
    published_at: str,
    staged: dict[str, Any] | None = None,
) -> dict[str, Any]:
    true_rows = validation.get("trueRows") or []
    first_time = validation.get("firstAnchorTime")
    last_time = validation.get("lastTrueM1Time")
    if true_rows:
        first_time = int(true_rows[0]["time"])
        last_time = int(true_rows[-1]["time"])

    return {
        "ok": True,
        "status": "mt5_m1_check_completed" if validation.get("ok") else "mt5_m1_check_failed_validation",
        "provider": "mt5",
        "storeVersion": "v5",
        "symbol": symbol,
        "directM1": {
            "datasetKey": f"mt5:{symbol}:direct:M1",
            "mt5RowsCount": validation.get("mt5RowsCount", len(raw_rows)),
            "trueM1RowsCount": validation.get("trueM1RowsCount", 0),
            "rowsCount": validation.get("trueM1RowsCount", 0),
            "firstTime": first_time,
            "lastTime": last_time,
            "firstTimeText": format_utc_text(first_time),
            "lastTimeText": format_utc_text(last_time),
            "firstAnchorTime": validation.get("firstAnchorTime"),
            "firstHourM1CheckOk": validation.get("firstHourM1CheckOk"),
            "firstHourTrueRows": validation.get("firstHourTrueRows"),
            "gapCount": validation.get("gapCount"),
            "m1IntegrityStatus": validation.get("m1IntegrityStatus"),
            "status": "mt5_live_check",
            "validationOk": validation.get("ok"),
            "validationError": validation.get("error"),
            "firstGap": validation.get("firstGap"),
        },
        "validation": {key: value for key, value in validation.items() if key != "trueRows"},
        "aggregated": [],
        "staged": staged,
        "publishedAt": published_at,
    }


def _build_incremental_m1_check_payload(
    *,
    symbol: str,
    raw_rows: list[dict[str, Any]],
    validation: dict[str, Any],
    published_at: str,
    base: dict[str, Any],
    staged: dict[str, Any] | None = None,
) -> dict[str, Any]:
    base_first_time = base.get("firstTime")
    base_last_time = int(base["lastTime"])
    base_true_count = int(base.get("trueM1RowsCount") or base.get("rowsCount") or 0)
    base_mt5_count = int(base.get("mt5RowsCount") or base_true_count)
    added_true_count = int(validation.get("trueM1RowsCount") or 0) if validation.get("ok") else 0
    last_time = int(validation.get("lastNewTime") or base_last_time)
    true_count = base_true_count + added_true_count
    mt5_count = base_mt5_count + added_true_count
    return {
        "ok": validation.get("ok") is True,
        "status": "mt5_m1_incremental_check_completed" if validation.get("ok") else "mt5_m1_incremental_check_failed_validation",
        "provider": "mt5",
        "storeVersion": "v5",
        "symbol": symbol,
        "directM1": {
            "datasetKey": f"mt5:{symbol}:direct:M1",
            "mt5RowsCount": mt5_count,
            "trueM1RowsCount": true_count,
            "rowsCount": true_count,
            "firstTime": base_first_time,
            "lastTime": last_time,
            "firstTimeText": format_utc_text(base_first_time),
            "lastTimeText": format_utc_text(last_time),
            "firstAnchorTime": base.get("firstAnchorTime") or base_first_time,
            "firstHourM1CheckOk": base.get("firstHourM1CheckOk"),
            "firstHourTrueRows": base.get("firstHourTrueRows"),
            "gapCount": base.get("gapCount"),
            "m1IntegrityStatus": validation.get("status") or "incremental_true_m1_ok",
            "status": "mt5_live_incremental_check",
            "validationOk": validation.get("ok"),
            "validationError": validation.get("error"),
            "firstGap": validation.get("firstGap"),
        },
        "validation": {key: value for key, value in validation.items() if key != "trueRows"},
        "aggregated": [],
        "staged": staged,
        "publishedAt": published_at,
    }


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
    with M1_CHECK_JOBS_LOCK:
        M1_CHECK_JOBS[job_id] = {
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
        }
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
