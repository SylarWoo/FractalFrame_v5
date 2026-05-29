from __future__ import annotations

from typing import Any

from .features import finite_number


def centered_window(index: int, rows_count: int, radius: int) -> tuple[int, int]:
    return max(0, index - radius), min(rows_count - 1, index + radius)


def highest_high_index(highs: Any, start_index: int, end_index: int) -> int | None:
    highest_index: int | None = None
    highest_value: float | None = None
    for index in range(start_index, end_index + 1):
        value = highs[index]
        if not finite_number(value):
            continue
        high = float(value)
        if highest_value is None or high > highest_value:
            highest_value = high
            highest_index = index
    return highest_index


def lowest_low_index(lows: Any, start_index: int, end_index: int) -> int | None:
    lowest_index: int | None = None
    lowest_value: float | None = None
    for index in range(start_index, end_index + 1):
        value = lows[index]
        if not finite_number(value):
            continue
        low = float(value)
        if lowest_value is None or low < lowest_value:
            lowest_value = low
            lowest_index = index
    return lowest_index
