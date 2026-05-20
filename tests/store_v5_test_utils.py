ANCHOR = 1735768800  # 2025-01-01 22:00:00 UTC


def make_rows(start: int, count: int, *, gap_after: int | None = None) -> list[dict]:
    rows = []
    shift = 0
    for i in range(count):
        if gap_after is not None and i > gap_after:
            shift = 180
        time_value = start + i * 60 + shift
        rows.append(
            {
                "time": time_value,
                "open": float(i),
                "high": float(i + 2),
                "low": float(i - 1),
                "close": float(i + 1),
                "volume": i + 10,
            }
        )
    return rows
