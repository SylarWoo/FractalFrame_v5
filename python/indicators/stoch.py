from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd


@dataclass(frozen=True)
class StochSettings:
    length: int = 14
    k_smoothing: int = 3
    d_smoothing: int = 3


def normalize_stoch_settings(settings: Any | None = None) -> StochSettings:
    source = settings or StochSettings()
    return StochSettings(
        length=_safe_int(_read_setting(source, "length", "length", 14), 14, minimum=1),
        k_smoothing=_safe_int(_read_setting(source, "k_smoothing", "kSmoothing", 3), 3, minimum=1),
        d_smoothing=_safe_int(_read_setting(source, "d_smoothing", "dSmoothing", 3), 3, minimum=1),
    )


def calculate_stoch_frame(frame: pd.DataFrame, settings: Any | None = None) -> pd.DataFrame:
    active_settings = normalize_stoch_settings(settings)
    highest_high = frame["high"].rolling(window=active_settings.length, min_periods=active_settings.length).max()
    lowest_low = frame["low"].rolling(window=active_settings.length, min_periods=active_settings.length).min()
    price_range = highest_high - lowest_low
    raw_k = ((frame["close"] - lowest_low) / price_range) * 100
    raw_k = raw_k.where(price_range != 0)
    k = raw_k.rolling(window=active_settings.k_smoothing, min_periods=active_settings.k_smoothing).mean()
    d = k.rolling(window=active_settings.d_smoothing, min_periods=active_settings.d_smoothing).mean()
    out = pd.DataFrame(index=frame.index)
    out["stochK"] = k
    out["stochD"] = d
    out["stochLength"] = active_settings.length
    out["stochKSmoothing"] = active_settings.k_smoothing
    out["stochDSmoothing"] = active_settings.d_smoothing
    return out


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
