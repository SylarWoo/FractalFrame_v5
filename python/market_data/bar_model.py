from __future__ import annotations

from typing import Any

import pandas as pd

BAR_ID_COLUMNS = ["barKey", "sourceIndex", "calcIndex"]
OHLCV_COLUMNS = ["time", "open", "high", "low", "close", "volume"]
NORMALIZED_BAR_COLUMNS = [*BAR_ID_COLUMNS, *OHLCV_COLUMNS]


def create_fallback_bar_key(time_seconds: Any) -> str:
    return f"bar:{int(float(time_seconds))}"


def normalize_ohlcv_bars(rows: list[dict[str, Any]] | pd.DataFrame) -> pd.DataFrame:
    frame = rows.copy() if isinstance(rows, pd.DataFrame) else pd.DataFrame(rows)
    if frame.empty:
        return pd.DataFrame(columns=NORMALIZED_BAR_COLUMNS)

    required = ["time", "open", "high", "low", "close"]
    missing = [name for name in required if name not in frame.columns]
    if missing:
        raise ValueError(f"OHLCV rows missing required columns: {', '.join(missing)}")

    frame = frame.copy()
    if "sourceIndex" not in frame.columns:
        frame["sourceIndex"] = frame.index

    for name in OHLCV_COLUMNS:
        if name in frame.columns:
            frame[name] = pd.to_numeric(frame[name], errors="coerce")
    frame["sourceIndex"] = pd.to_numeric(frame["sourceIndex"], errors="coerce")
    frame = frame.dropna(subset=required)

    if "barKey" not in frame.columns:
        frame["barKey"] = frame["time"].map(create_fallback_bar_key)
    frame["barKey"] = frame["barKey"].astype(str)

    frame = frame.sort_values("time").drop_duplicates(subset=["time"], keep="last").reset_index(drop=True)
    frame["calcIndex"] = frame.index
    return frame


def create_bar_alignment_debug(raw_rows: list[dict[str, Any]] | pd.DataFrame, normalized: pd.DataFrame) -> dict[str, Any]:
    raw_frame = raw_rows.copy() if isinstance(raw_rows, pd.DataFrame) else pd.DataFrame(raw_rows)
    raw_count = int(len(raw_frame))
    normalized_count = int(len(normalized))

    duplicate_times: list[int] = []
    if "time" in raw_frame.columns:
        raw_times = pd.to_numeric(raw_frame["time"], errors="coerce").dropna().astype("int64")
        duplicate_times = [int(value) for value in raw_times[raw_times.duplicated(keep=False)].drop_duplicates().tolist()]

    if "sourceIndex" in raw_frame.columns:
        raw_source_indexes = {
            int(value)
            for value in pd.to_numeric(raw_frame["sourceIndex"], errors="coerce").dropna().tolist()
        }
    else:
        raw_source_indexes = set(range(raw_count))
    normalized_source_indexes = set()
    if "sourceIndex" in normalized.columns:
        normalized_source_indexes = {
            int(value)
            for value in pd.to_numeric(normalized["sourceIndex"], errors="coerce").dropna().tolist()
        }

    dropped_source_indexes = sorted(raw_source_indexes - normalized_source_indexes)
    return {
        "requestedBars": raw_count,
        "normalizedBars": normalized_count,
        "droppedBars": len(dropped_source_indexes),
        "droppedSourceIndexes": dropped_source_indexes[:50],
        "duplicateTimes": duplicate_times[:50],
        "hasBarKey": "barKey" in raw_frame.columns,
        "barKeyUnique": bool(normalized["barKey"].is_unique) if "barKey" in normalized.columns else False,
    }
