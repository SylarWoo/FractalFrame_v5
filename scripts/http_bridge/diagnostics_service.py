from __future__ import annotations

from pathlib import Path
from typing import Any
import os

from .jobs import AGGREGATE_JOBS, M1_CHECK_JOBS, PULL_JOBS
from .operation_locks import active_operations
from .store_v5_status_service import utc_now_iso
from .mt5_m1_check_job_state import M1_CHECK_JOB_STORE
from .store_v5_aggregate_job_service import AGGREGATE_JOB_STORE
from .store_v5_pull_job_state import PULL_JOB_STORE


STARTED_AT = utc_now_iso()


def check_mt5_diagnostics(symbol: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "ok": True,
        "status": "mt5_diagnostics_ok",
        "symbol": symbol,
        "publishedAt": utc_now_iso(),
    }
    initialized = False
    try:
        import MetaTrader5 as mt5
    except ImportError as exc:
        return {**payload, "ok": False, "status": "mt5_unavailable", "error": str(exc)}

    try:
        if not mt5.initialize():
            return {**payload, "ok": False, "status": "mt5_initialize_failed", "mt5LastError": mt5.last_error()}
        initialized = True
        terminal_info = mt5.terminal_info()
        account_info = mt5.account_info()
        payload["terminal"] = terminal_info._asdict() if hasattr(terminal_info, "_asdict") and terminal_info else None
        payload["account"] = account_info._asdict() if hasattr(account_info, "_asdict") and account_info else None
        if symbol:
            payload["symbolSelectOk"] = bool(mt5.symbol_select(symbol, True))
            payload["symbolInfo"] = mt5.symbol_info(symbol)._asdict() if mt5.symbol_info(symbol) is not None else None
            if not payload["symbolSelectOk"]:
                payload["ok"] = False
                payload["status"] = "mt5_symbol_select_failed"
                payload["mt5LastError"] = mt5.last_error()
        return payload
    except Exception as exc:
        return {**payload, "ok": False, "status": "mt5_diagnostics_exception", "error": str(exc)}
    finally:
        if initialized:
            try:
                mt5.shutdown()
            except Exception:
                pass


def runtime_observability(*, cache_root: Path, store_root: Path | None) -> dict[str, Any]:
    def count_failed(jobs: dict[str, dict[str, Any]]) -> int:
        return sum(1 for job in jobs.values() if str(job.get("phase") or "") == "failed")

    return {
        "ok": True,
        "status": "runtime_observability_ok",
        "startedAt": STARTED_AT,
        "publishedAt": utc_now_iso(),
        "paths": {
            "cacheRoot": str(cache_root),
            "storeRoot": str(store_root) if store_root else "default runtime_data/store_v5",
        },
        "jobs": {
            "m1Check": {"count": len(M1_CHECK_JOBS), "failed": count_failed(M1_CHECK_JOBS)},
            "pull": {"count": len(PULL_JOBS), "failed": count_failed(PULL_JOBS)},
            "aggregate": {"count": len(AGGREGATE_JOBS), "failed": count_failed(AGGREGATE_JOBS)},
        },
        "activeOperations": active_operations(),
    }


def job_history(limit: int = 20) -> dict[str, Any]:
    return {
        "ok": True,
        "status": "job_history_ok",
        "publishedAt": utc_now_iso(),
        "jobs": {
            "m1Check": M1_CHECK_JOB_STORE.recent(limit=limit),
            "pull": PULL_JOB_STORE.recent(limit=limit),
            "aggregate": AGGREGATE_JOB_STORE.recent(limit=limit),
        },
    }


def tail_bridge_logs(tail: int = 200) -> dict[str, Any]:
    log_root = Path(os.environ.get("FRACTALFRAME_LOG_ROOT", "runtime_data/logs"))
    path = log_root / "bridge.log"
    if not path.exists():
        return {"ok": True, "status": "logs_empty", "path": str(path), "lines": []}
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    return {"ok": True, "status": "logs_ready", "path": str(path), "lines": lines[-max(1, min(int(tail), 1000)):]}
