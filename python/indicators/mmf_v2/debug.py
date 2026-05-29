from __future__ import annotations

from math import isfinite
from typing import Any

import pandas as pd


def safe_float(value: Any) -> float | None:
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    return out if isfinite(out) else None


def create_debug_rows(features: pd.DataFrame) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for index in range(len(features)):
        row = features.iloc[index]
        rows.append({
            "index": index,
            "time": int(row["time"]) if safe_float(row.get("time")) is not None else None,
            "stochK": safe_float(row.get("stochK")),
            "stochD": safe_float(row.get("stochD")),
            "vdo": safe_float(row.get("vdo")),
            "ma": safe_float(row.get("ma")),
            "morganSegmentIndex": int(row["morganSegmentIndex"]) if safe_float(row.get("morganSegmentIndex")) is not None else None,
        })
    return rows
