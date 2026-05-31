from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd


@dataclass(frozen=True)
class TsiSettings:
    long_length: int = 25
    short_length: int = 13
    signal_length: int = 13


def normalize_tsi_settings(settings: Any | None = None) -> TsiSettings:
    source = settings or TsiSettings()
    return TsiSettings(
        long_length=_safe_int(_read_setting(source, "long_length", "longLength", 25), 25, minimum=1),
        short_length=_safe_int(_read_setting(source, "short_length", "shortLength", 13), 13, minimum=1),
        signal_length=_safe_int(_read_setting(source, "signal_length", "signalLength", 13), 13, minimum=1),
    )


def calculate_tsi_frame(frame: pd.DataFrame, settings: Any | None = None) -> pd.DataFrame:
    active_settings = normalize_tsi_settings(settings)
    close = pd.to_numeric(frame["close"], errors="coerce")
    change = close.diff()
    if len(change) > 0:
        change.iloc[0] = 0
    abs_change = change.abs()
    double_momentum = _ema(_ema(change, active_settings.long_length), active_settings.short_length)
    double_abs_momentum = _ema(_ema(abs_change, active_settings.long_length), active_settings.short_length)
    tsi = 100 * double_momentum / double_abs_momentum
    tsi = tsi.where(double_abs_momentum != 0)
    signal = _ema(tsi, active_settings.signal_length)
    previous_tsi = tsi.shift(1)
    previous_signal = signal.shift(1)
    previous_zero = tsi.shift(1)
    out = pd.DataFrame(index=frame.index)
    out["tsi"] = tsi
    out["tsiSignal"] = signal
    out["tsiHistogram"] = tsi - signal
    out["tsiDelta"] = tsi.diff()
    out["tsiDirection"] = (out["tsiDelta"] > 0).astype("int8") - (out["tsiDelta"] < 0).astype("int8")
    out["tsiCrossUpSignal"] = (previous_tsi < previous_signal) & (tsi >= signal)
    out["tsiCrossDownSignal"] = (previous_tsi > previous_signal) & (tsi <= signal)
    out["tsiCrossUpZero"] = (previous_zero < 0) & (tsi >= 0)
    out["tsiCrossDownZero"] = (previous_zero > 0) & (tsi <= 0)
    out["tsiLongLength"] = active_settings.long_length
    out["tsiShortLength"] = active_settings.short_length
    out["tsiSignalLength"] = active_settings.signal_length
    return out


def _ema(values: pd.Series, period: int) -> pd.Series:
    return values.ewm(span=period, adjust=False, min_periods=1).mean()


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
