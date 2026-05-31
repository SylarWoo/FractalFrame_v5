from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd

from python.indicators.vdo import VdoSettings, calculate_vdo_values, normalize_vdo_settings


@dataclass(frozen=True)
class VmiSettings:
    fast_length: int = 5
    slow_length: int = 34
    vdo: VdoSettings = VdoSettings()


def normalize_vmi_settings(settings: Any | None = None) -> VmiSettings:
    source = settings or VmiSettings()
    return VmiSettings(
        fast_length=_safe_int(_read_setting(source, "fast_length", "fastLength", 5), 5, minimum=1),
        slow_length=_safe_int(_read_setting(source, "slow_length", "slowLength", 34), 34, minimum=1),
        vdo=normalize_vdo_settings(_read_setting(source, "vdo", "vdo", None)),
    )


def calculate_vmi_frame(frame: pd.DataFrame, settings: Any | None = None) -> pd.DataFrame:
    active_settings = normalize_vmi_settings(settings)
    provided_vdo = _read_setting(settings or {}, "vdo_values", "vdoValues", None)
    vdo = provided_vdo if isinstance(provided_vdo, pd.Series) else calculate_vdo_values(frame, active_settings.vdo)
    fast = vdo.rolling(window=active_settings.fast_length, min_periods=active_settings.fast_length).mean()
    slow = vdo.rolling(window=active_settings.slow_length, min_periods=active_settings.slow_length).mean()
    histogram = fast - slow
    previous = histogram.shift(1)
    out = pd.DataFrame(index=frame.index)
    out["vmiFastMa"] = fast
    out["vmiSlowMa"] = slow
    out["vmiHistogram"] = histogram
    out["vmiDelta"] = histogram.diff()
    out["vmiDirection"] = (out["vmiDelta"] > 0).astype("int8") - (out["vmiDelta"] < 0).astype("int8")
    out["vmiCrossUpZero"] = (previous < 0) & (histogram >= 0)
    out["vmiCrossDownZero"] = (previous > 0) & (histogram <= 0)
    out["vmiFastLength"] = active_settings.fast_length
    out["vmiSlowLength"] = active_settings.slow_length
    return out


def vmi_frame_to_payload(frame: pd.DataFrame) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for index in range(len(frame)):
        row = frame.iloc[index]
        rows.append({
            "histogram": _json_number(row.get("vmiHistogram")),
            "fastMa": _json_number(row.get("vmiFastMa")),
            "slowMa": _json_number(row.get("vmiSlowMa")),
            "delta": _json_number(row.get("vmiDelta")),
            "direction": _json_number(row.get("vmiDirection")),
            "crossUpZero": bool(row.get("vmiCrossUpZero", False)),
            "crossDownZero": bool(row.get("vmiCrossDownZero", False)),
        })
    return rows


def _json_number(value: Any) -> float | int | None:
    number = pd.to_numeric(value, errors="coerce")
    if pd.isna(number):
        return None
    out = float(number)
    return int(out) if out.is_integer() else out


def _read_setting(source: Any, snake_key: str, camel_key: str, fallback: Any) -> Any:
    if isinstance(source, dict):
        return source.get(snake_key, source.get(camel_key, fallback))
    if hasattr(source, snake_key):
        return getattr(source, snake_key)
    return getattr(source, camel_key, fallback)


def _safe_int(value: Any, fallback: int, minimum: int = 0) -> int:
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError):
        return fallback
    return max(minimum, number)
