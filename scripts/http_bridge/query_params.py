from __future__ import annotations

from typing import Any


def clamp_limit(value: str | None, default: int = 50_000) -> int:
    try:
        parsed = int(value or default)
    except ValueError:
        parsed = default
    return max(1, min(parsed, 50_000))


def clamp_m1_check_count(value: str | None, default: int = 200_000) -> int:
    try:
        parsed = int(value or default)
    except ValueError:
        parsed = default
    return max(1, min(parsed, 10_000_000))


def clamp_m1_check_chunk(value: str | None, default: int = 200_000) -> int:
    try:
        parsed = int(value or default)
    except ValueError:
        parsed = default
    return max(1_000, min(parsed, 500_000))


def safe_query_int(value: str | None, default: int | None = None) -> int | None:
    if value is None or value == "":
        return default
    try:
        return int(value)
    except ValueError:
        return default


def query_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "y", "on"}
