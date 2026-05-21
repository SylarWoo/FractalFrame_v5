from __future__ import annotations

from typing import Any

from .store_v5_status_service import format_utc_text


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
    base_gap_count = base.get("gapCount")
    incremental_gap_count = int(validation.get("gapCount") or 0) if validation.get("ok") else 0
    gap_count = (int(base_gap_count) if base_gap_count is not None else 0) + incremental_gap_count
    first_gap = base.get("firstGap") or validation.get("firstGap")
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
            "gapCount": gap_count,
            "m1IntegrityStatus": validation.get("m1IntegrityStatus") or validation.get("status") or "incremental_true_m1_ok",
            "status": "mt5_live_incremental_check",
            "validationOk": validation.get("ok"),
            "validationError": validation.get("error"),
            "firstGap": first_gap,
        },
        "validation": {key: value for key, value in validation.items() if key != "trueRows"},
        "aggregated": [],
        "staged": staged,
        "publishedAt": published_at,
    }
