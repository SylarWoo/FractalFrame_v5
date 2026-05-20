from __future__ import annotations

from typing import Any


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
