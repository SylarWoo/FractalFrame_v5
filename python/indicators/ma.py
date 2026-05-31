from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd


@dataclass(frozen=True)
class MaSettings:
    length: int = 20
    ma_type: str = "sma"
    source: str = "close"


def normalize_ma_settings(settings: Any | None = None) -> MaSettings:
    source = settings or MaSettings()
    return MaSettings(
        length=_safe_int(_read_setting(source, "length", "length", 20), 20, minimum=1),
        ma_type=str(_read_setting(source, "ma_type", "type", "sma") or "sma").lower(),
        source=str(_read_setting(source, "source", "source", "close") or "close").lower(),
    )


def calculate_ma_values(frame: pd.DataFrame, settings: Any | None = None) -> pd.Series:
    active_settings = normalize_ma_settings(settings)
    values = source_series(frame, active_settings.source)
    if active_settings.ma_type == "ema":
        return values.ewm(span=active_settings.length, adjust=False, min_periods=active_settings.length).mean()
    return values.rolling(window=active_settings.length, min_periods=active_settings.length).mean()


def calculate_ma_frame(frame: pd.DataFrame, settings: Any | None = None) -> pd.DataFrame:
    active_settings = normalize_ma_settings(settings)
    out = pd.DataFrame(index=frame.index)
    out["ma"] = calculate_ma_values(frame, active_settings)
    out["maLength"] = active_settings.length
    out["maType"] = active_settings.ma_type
    out["maSource"] = active_settings.source
    return out


def source_series(frame: pd.DataFrame, source: str) -> pd.Series:
    match str(source or "close").lower():
        case "open":
            return frame["open"]
        case "high":
            return frame["high"]
        case "low":
            return frame["low"]
        case "hl2":
            return (frame["high"] + frame["low"]) / 2
        case "hlc3":
            return (frame["high"] + frame["low"] + frame["close"]) / 3
        case "ohlc4":
            return (frame["open"] + frame["high"] + frame["low"] + frame["close"]) / 4
        case _:
            return frame["close"]


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
