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
            "vdoCrossDownLower3": bool(row.get("vdoCrossDownLower3", False)),
            "vdoCrossDownLower2": bool(row.get("vdoCrossDownLower2", False)),
            "vdoCrossDownLower": bool(row.get("vdoCrossDownLower", False)),
            "vdoCrossDownZero": bool(row.get("vdoCrossDownZero", False)),
            "vdoCrossDownUpper2": bool(row.get("vdoCrossDownUpper2", False)),
            "vdoCrossDownUpper": bool(row.get("vdoCrossDownUpper", False)),
            "vdoCrossDownUpper3": bool(row.get("vdoCrossDownUpper3", False)),
            "vdoCrossUpLower3": bool(row.get("vdoCrossUpLower3", False)),
            "vdoCrossUpLower2": bool(row.get("vdoCrossUpLower2", False)),
            "vdoCrossUpLower": bool(row.get("vdoCrossUpLower", False)),
            "vdoCrossUpZero": bool(row.get("vdoCrossUpZero", False)),
            "vdoCrossUpUpper2": bool(row.get("vdoCrossUpUpper2", False)),
            "vdoCrossUpUpper": bool(row.get("vdoCrossUpUpper", False)),
            "vdoCrossUpUpper3": bool(row.get("vdoCrossUpUpper3", False)),
            "vdoEnterOverbought": bool(row.get("vdoEnterOverbought", False)),
            "vdoExitOverbought": bool(row.get("vdoExitOverbought", False)),
            "vdoOverboughtActive": bool(row.get("vdoOverboughtActive", False)),
            "vdoOverboughtEpoch": int(row["vdoOverboughtEpoch"]) if safe_float(row.get("vdoOverboughtEpoch")) is not None else None,
            "vdoEnterOversold": bool(row.get("vdoEnterOversold", False)),
            "vdoExitOversold": bool(row.get("vdoExitOversold", False)),
            "vdoOversoldActive": bool(row.get("vdoOversoldActive", False)),
            "vdoOversoldEpoch": int(row["vdoOversoldEpoch"]) if safe_float(row.get("vdoOversoldEpoch")) is not None else None,
            "vmi": safe_float(row.get("vmiHistogram")),
            "vmiCrossDownZero": bool(row.get("vmiCrossDownZero", False)),
            "vmiCrossUpZero": bool(row.get("vmiCrossUpZero", False)),
            "tsi": safe_float(row.get("tsi")),
            "tsiSignal": safe_float(row.get("tsiSignal")),
            "tsiHistogram": safe_float(row.get("tsiHistogram")),
            "tsiCrossDownSignal": bool(row.get("tsiCrossDownSignal", False)),
            "tsiCrossUpSignal": bool(row.get("tsiCrossUpSignal", False)),
            "tsiCrossDownZero": bool(row.get("tsiCrossDownZero", False)),
            "tsiCrossUpZero": bool(row.get("tsiCrossUpZero", False)),
            "ma": safe_float(row.get("ma")),
            "morganSegmentIndex": int(row["morganSegmentIndex"]) if safe_float(row.get("morganSegmentIndex")) is not None else None,
        })
    return rows
