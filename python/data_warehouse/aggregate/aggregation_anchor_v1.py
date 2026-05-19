from __future__ import annotations

from datetime import datetime, timedelta, timezone


ANCHOR_UTC2200 = "UTC2200"
SUPPORTED_TIMEFRAMES = ["M5", "M15", "M30", "H1", "H2", "H3", "H4", "D1", "W1", "MN1"]


FIXED_SECONDS = {
    "M5": 5 * 60,
    "M15": 15 * 60,
    "M30": 30 * 60,
    "H1": 60 * 60,
    "H2": 2 * 60 * 60,
    "H3": 3 * 60 * 60,
    "H4": 4 * 60 * 60,
    "D1": 24 * 60 * 60,
    "W1": 7 * 24 * 60 * 60,
}


def anchor_offset_seconds(anchor: str = ANCHOR_UTC2200) -> int:
    if anchor != ANCHOR_UTC2200:
        raise ValueError(f"Unsupported aggregation anchor: {anchor}")
    return 22 * 3600


def fixed_bucket_start(time_value: int, timeframe: str, anchor: str = ANCHOR_UTC2200) -> int:
    # The anchor is a trading-day split rule, not a requirement that a bar exists at that time.
    seconds = FIXED_SECONDS[timeframe]
    offset = anchor_offset_seconds(anchor)
    return ((int(time_value) - offset) // seconds) * seconds + offset


def month_anchor_start(time_value: int, anchor: str = ANCHOR_UTC2200) -> int:
    offset_hour = anchor_offset_seconds(anchor) // 3600
    dt = datetime.fromtimestamp(int(time_value), tz=timezone.utc)
    current = datetime(dt.year, dt.month, 1, offset_hour, tzinfo=timezone.utc)
    if dt >= current:
        return int(current.timestamp())
    if dt.month == 1:
        return int(datetime(dt.year - 1, 12, 1, offset_hour, tzinfo=timezone.utc).timestamp())
    return int(datetime(dt.year, dt.month - 1, 1, offset_hour, tzinfo=timezone.utc).timestamp())


def week_anchor_start(time_value: int, anchor: str = ANCHOR_UTC2200) -> int:
    offset_hour = anchor_offset_seconds(anchor) // 3600
    dt = datetime.fromtimestamp(int(time_value), tz=timezone.utc)
    week_start_date = (dt - timedelta(days=dt.weekday())).date()
    current = datetime(
        week_start_date.year,
        week_start_date.month,
        week_start_date.day,
        offset_hour,
        tzinfo=timezone.utc,
    )
    if dt >= current:
        return int(current.timestamp())
    previous = current - timedelta(days=7)
    return int(previous.timestamp())


def next_month_anchor(start_time: int, anchor: str = ANCHOR_UTC2200) -> int:
    offset_hour = anchor_offset_seconds(anchor) // 3600
    dt = datetime.fromtimestamp(int(start_time), tz=timezone.utc)
    year, month = dt.year, dt.month
    if month == 12:
        year, month = year + 1, 1
    else:
        month += 1
    return int(datetime(year, month, 1, offset_hour, tzinfo=timezone.utc).timestamp())


def expected_minutes_for_bucket(start_time: int, timeframe: str, anchor: str = ANCHOR_UTC2200) -> int:
    if timeframe == "MN1":
        return (next_month_anchor(start_time, anchor) - start_time) // 60
    return FIXED_SECONDS[timeframe] // 60
