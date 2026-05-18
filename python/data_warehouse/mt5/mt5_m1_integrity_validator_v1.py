from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


SECONDS_PER_MINUTE = 60


def _row_time(row: dict[str, Any]) -> int:
    return int(row["time"])


def _dedupe_sort(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_time: dict[int, dict[str, Any]] = {}
    for row in rows:
        by_time[_row_time(row)] = row
    return [by_time[t] for t in sorted(by_time)]


def _anchor_mod(anchor_hour_utc: int) -> int:
    return int(anchor_hour_utc) * 3600


def _is_anchor_time(value: int, anchor_hour_utc: int) -> bool:
    return value % 86400 == _anchor_mod(anchor_hour_utc)


def _time_text(value: int) -> str:
    return datetime.fromtimestamp(value, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def _gap(previous: int, next_time: int) -> dict[str, int]:
    delta = next_time - previous
    return {
        "previousTime": previous,
        "nextTime": next_time,
        "deltaSeconds": delta,
        "missingBarsEstimate": max(0, delta // SECONDS_PER_MINUTE - 1),
    }


def _first_hour_check(candidate_rows: list[dict[str, Any]], first_anchor_time: int) -> tuple[bool, int, dict[str, int] | None]:
    first_hour_rows = [row for row in candidate_rows if first_anchor_time <= _row_time(row) < first_anchor_time + 3600]
    first_hour_gap = None
    for previous, current in zip(first_hour_rows, first_hour_rows[1:]):
        if _row_time(current) - _row_time(previous) != SECONDS_PER_MINUTE:
            first_hour_gap = _gap(_row_time(previous), _row_time(current))
            break
    return len(first_hour_rows) == 60 and first_hour_gap is None, len(first_hour_rows), first_hour_gap


def validate_true_m1_rows_v1(
    rows: list[dict[str, Any]],
    *,
    anchor_hour_utc: int = 22,
    strict_continuous: bool = True,
    require_first_hour_complete: bool = True,
) -> dict[str, Any]:
    mt5_count = len(rows)
    ordered = _dedupe_sort(rows)
    anchor_indexes = [i for i, row in enumerate(ordered) if _is_anchor_time(_row_time(row), anchor_hour_utc)]
    anchor_index = anchor_indexes[0] if anchor_indexes else None
    if anchor_index is None:
        return {
            "ok": False,
            "error": "no_utc_2200_anchor_found",
            "mt5RowsCount": mt5_count,
            "trueM1RowsCount": 0,
            "trueRows": [],
        }

    first_failed_hour: dict[str, Any] | None = None
    first_anchor_time = _row_time(ordered[anchor_index])
    candidate_rows = ordered[anchor_index:]
    first_hour_ok, first_hour_true_rows, first_hour_gap = _first_hour_check(candidate_rows, first_anchor_time)
    if require_first_hour_complete and not first_hour_ok:
        first_failed_hour = {
            "firstAnchorTime": first_anchor_time,
            "firstAnchorText": _time_text(first_anchor_time),
            "firstHourTrueRows": first_hour_true_rows,
            "firstGap": first_hour_gap,
        }
        for next_anchor_index in anchor_indexes[1:]:
            next_anchor_time = _row_time(ordered[next_anchor_index])
            next_candidate_rows = ordered[next_anchor_index:]
            next_first_hour_ok, next_first_hour_true_rows, next_first_hour_gap = _first_hour_check(
                next_candidate_rows,
                next_anchor_time,
            )
            if next_first_hour_ok:
                anchor_index = next_anchor_index
                first_anchor_time = next_anchor_time
                candidate_rows = next_candidate_rows
                first_hour_ok = next_first_hour_ok
                first_hour_true_rows = next_first_hour_true_rows
                first_hour_gap = next_first_hour_gap
                break

    if require_first_hour_complete and not first_hour_ok:
        failed = first_failed_hour or {
            "firstAnchorTime": first_anchor_time,
            "firstAnchorText": _time_text(first_anchor_time),
            "firstHourTrueRows": first_hour_true_rows,
            "firstGap": first_hour_gap,
        }
        return {
            "ok": False,
            "error": "first_hour_m1_not_continuous",
            "mt5RowsCount": mt5_count,
            "firstAnchorTime": failed["firstAnchorTime"],
            "firstAnchorText": failed["firstAnchorText"],
            "firstHourExpectedRows": 60,
            "firstHourTrueRows": failed["firstHourTrueRows"],
            "firstHourM1CheckOk": False,
            "firstGap": failed["firstGap"],
            "trueM1RowsCount": 0,
            "trueRows": [],
        }

    true_rows: list[dict[str, Any]] = []
    first_gap = None
    for row in candidate_rows:
        if not true_rows:
            true_rows.append(row)
            continue
        previous_time = _row_time(true_rows[-1])
        current_time = _row_time(row)
        delta = current_time - previous_time
        if delta == SECONDS_PER_MINUTE:
            true_rows.append(row)
            continue
        if delta > SECONDS_PER_MINUTE:
            first_gap = _gap(previous_time, current_time)
            if strict_continuous:
                break
            true_rows.append(row)
            continue
        continue

    status = "true_m1_continuous" if first_gap is None else "true_m1_truncated_at_gap"
    result = {
        "ok": True,
        "mt5RowsCount": mt5_count,
        "trueM1RowsCount": len(true_rows),
        "discardedBeforeAnchorRowsCount": anchor_index,
        "firstAnchorTime": first_anchor_time,
        "firstAnchorText": _time_text(first_anchor_time),
        "firstHourExpectedRows": 60,
        "firstHourTrueRows": first_hour_true_rows,
        "firstHourM1CheckOk": first_hour_ok,
        "gapCount": 0 if first_gap is None else 1,
        "firstGap": first_gap,
        "lastTrueM1Time": _row_time(true_rows[-1]) if true_rows else None,
        "m1IntegrityStatus": status,
        "trueRows": true_rows,
    }
    if first_gap is not None:
        result["warning"] = "m1_gap_detected_truncated_at_first_gap"
    return result


def validate_incremental_true_m1_rows_v1(
    rows: list[dict[str, Any]],
    *,
    last_true_m1_time: int,
    overlap_bars: int = 1000,
) -> dict[str, Any]:
    mt5_count = len(rows)
    ordered = _dedupe_sort(rows)
    times = [_row_time(row) for row in ordered]
    if last_true_m1_time not in times:
        return {
            "ok": False,
            "error": "last_true_m1_time_not_found_in_overlap",
            "mt5RowsCount": mt5_count,
            "lastTrueM1Time": last_true_m1_time,
            "overlapBars": overlap_bars,
            "trueM1RowsCount": 0,
            "trueRows": [],
        }

    true_rows = [row for row in ordered if _row_time(row) > last_true_m1_time]
    if not true_rows:
        return {
            "ok": True,
            "status": "no_new_true_m1_rows",
            "mt5RowsCount": mt5_count,
            "trueM1RowsCount": 0,
            "lastTrueM1Time": last_true_m1_time,
            "trueRows": [],
        }

    first_new_time = _row_time(true_rows[0])
    if first_new_time != last_true_m1_time + SECONDS_PER_MINUTE:
        return {
            "ok": False,
            "error": "incremental_gap_after_last_true_m1",
            "mt5RowsCount": mt5_count,
            "lastTrueM1Time": last_true_m1_time,
            "firstNewTime": first_new_time,
            "deltaSeconds": first_new_time - last_true_m1_time,
            "missingBarsEstimate": max(0, (first_new_time - last_true_m1_time) // SECONDS_PER_MINUTE - 1),
            "trueM1RowsCount": 0,
            "trueRows": [],
        }

    accepted = [true_rows[0]]
    for row in true_rows[1:]:
        previous_time = _row_time(accepted[-1])
        current_time = _row_time(row)
        if current_time - previous_time != SECONDS_PER_MINUTE:
            first_gap = _gap(previous_time, current_time)
            return {
                "ok": False,
                "error": "incremental_m1_gap_detected",
                "mt5RowsCount": mt5_count,
                "lastTrueM1Time": last_true_m1_time,
                "firstGap": first_gap,
                "trueM1RowsCount": 0,
                "trueRows": [],
            }
        accepted.append(row)

    return {
        "ok": True,
        "status": "incremental_true_m1_ok",
        "mt5RowsCount": mt5_count,
        "trueM1RowsCount": len(accepted),
        "lastTrueM1Time": last_true_m1_time,
        "firstNewTime": first_new_time,
        "lastNewTime": _row_time(accepted[-1]),
        "trueRows": accepted,
    }
