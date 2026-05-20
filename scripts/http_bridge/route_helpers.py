from __future__ import annotations


def first_query_value(query: dict[str, list[str]], *names: str, default: str = "") -> str:
    for name in names:
        values = query.get(name)
        if values:
            return values[0]
    return default


def required_symbol(query: dict[str, list[str]]) -> str:
    return first_query_value(query, "symbol").strip()


def required_job_id(query: dict[str, list[str]]) -> str:
    return first_query_value(query, "jobId", "job_id").strip()


def parse_timeframes(value: str, default: str = "") -> list[str]:
    raw = value or default
    return [item.strip().upper() for item in raw.split(",") if item.strip()]
