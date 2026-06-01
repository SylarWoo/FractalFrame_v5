from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd

from python.indicators.ma import source_series


@dataclass(frozen=True)
class VwapSettings:
    anchor_period: str = "session"
    band_calculation_mode: str = "standard_deviation"
    band1_multiplier: float = 1.0
    offset: int = 0
    source: str = "hlc3"
    symbol: str = ""


def normalize_vwap_settings(settings: Any | None = None) -> VwapSettings:
    source = settings or VwapSettings()
    return VwapSettings(
        anchor_period=str(_read_setting(source, "anchor_period", "anchorPeriod", "session") or "session").lower(),
        band_calculation_mode=str(_read_setting(source, "band_calculation_mode", "bandCalculationMode", "standard_deviation") or "standard_deviation").lower(),
        band1_multiplier=_safe_float(_read_setting(source, "band1_multiplier", "band1Multiplier", 1.0), 1.0),
        offset=_safe_int(_read_setting(source, "offset", "offset", 0), 0, minimum=-5000, maximum=5000),
        source=str(_read_setting(source, "source", "source", "hlc3") or "hlc3").lower(),
        symbol=str(_read_setting(source, "symbol", "symbol", "") or ""),
    )


def calculate_vwap_frame(frame: pd.DataFrame, settings: Any | None = None) -> pd.DataFrame:
    active_settings = normalize_vwap_settings(settings)
    out = pd.DataFrame(index=frame.index)
    if frame.empty:
        out["vwap"] = pd.Series(dtype="float64")
        out["vwapUpperBand"] = pd.Series(dtype="float64")
        out["vwapLowerBand"] = pd.Series(dtype="float64")
        return out

    values = source_series(frame, active_settings.source)
    volumes = _volume_series(frame)
    session_keys = _anchor_keys(frame, active_settings)
    vwap_values: list[float | None] = []
    upper_values: list[float | None] = []
    lower_values: list[float | None] = []
    current_key: int | None = None
    cumulative_price_volume = 0.0
    cumulative_price_squared_volume = 0.0
    cumulative_volume = 0.0

    for index in range(len(frame)):
        session_key = int(session_keys.iloc[index])
        if current_key != session_key:
            current_key = session_key
            cumulative_price_volume = 0.0
            cumulative_price_squared_volume = 0.0
            cumulative_volume = 0.0

        value = _safe_optional_float(values.iloc[index])
        volume = max(0.0, _safe_float(volumes.iloc[index], 0.0))
        if value is not None and volume > 0:
            cumulative_price_volume += value * volume
            cumulative_price_squared_volume += value * value * volume
            cumulative_volume += volume

        if cumulative_volume <= 0:
            vwap_values.append(None)
            upper_values.append(None)
            lower_values.append(None)
            continue

        vwap = cumulative_price_volume / cumulative_volume
        variance = max(0.0, cumulative_price_squared_volume / cumulative_volume - vwap * vwap)
        band_distance = abs(vwap * active_settings.band1_multiplier / 100) if active_settings.band_calculation_mode == "percentage" else variance ** 0.5 * active_settings.band1_multiplier
        vwap_values.append(vwap)
        upper_values.append(vwap + band_distance)
        lower_values.append(vwap - band_distance)

    out["vwap"] = _offset_series(pd.Series(vwap_values, index=frame.index, dtype="float64"), active_settings.offset)
    out["vwapUpperBand"] = _offset_series(pd.Series(upper_values, index=frame.index, dtype="float64"), active_settings.offset)
    out["vwapLowerBand"] = _offset_series(pd.Series(lower_values, index=frame.index, dtype="float64"), active_settings.offset)
    out["vwapSource"] = active_settings.source
    out["vwapAnchorPeriod"] = active_settings.anchor_period
    out["vwapBandCalculationMode"] = active_settings.band_calculation_mode
    out["vwapBand1Multiplier"] = active_settings.band1_multiplier
    return out


def _anchor_keys(frame: pd.DataFrame, settings: VwapSettings) -> pd.Series:
    timestamps = pd.to_numeric(frame["time"], errors="coerce").fillna(0).astype("int64")
    anchor_seconds = _session_anchor_hour_utc(settings.symbol) * 60 * 60 if settings.anchor_period == "session" else 0
    anchored_seconds = timestamps - anchor_seconds
    anchored_days = (anchored_seconds // 86_400).astype("int64")
    datetimes = pd.to_datetime(anchored_seconds * 1_000_000_000, utc=True)
    if settings.anchor_period == "week":
        return ((anchored_days + 4) // 7).astype("int64")
    if settings.anchor_period == "month":
        return (datetimes.dt.year * 12 + datetimes.dt.month).astype("int64")
    if settings.anchor_period == "quarter":
        return (datetimes.dt.year * 4 + ((datetimes.dt.month - 1) // 3)).astype("int64")
    if settings.anchor_period == "year":
        return datetimes.dt.year.astype("int64")
    if settings.anchor_period == "decade":
        return (datetimes.dt.year // 10).astype("int64")
    if settings.anchor_period == "century":
        return (datetimes.dt.year // 100).astype("int64")
    return anchored_days


def _session_anchor_hour_utc(symbol: str) -> int:
    normalized = symbol.upper()
    crypto_tokens = ("BTC", "ETH", "SOL", "XRP", "BNB", "ADA", "DOGE", "LTC", "BCH", "DOT", "AVAX", "TRX", "LINK")
    return 0 if any(token in normalized for token in crypto_tokens) else 22


def _volume_series(frame: pd.DataFrame) -> pd.Series:
    for name in ("volume", "tick_volume", "tickVolume", "real_volume", "realVolume", "vol", "Volume"):
        if name in frame.columns:
            return pd.to_numeric(frame[name], errors="coerce").fillna(0)
    return pd.Series(0, index=frame.index, dtype="float64")


def _offset_series(values: pd.Series, offset: int) -> pd.Series:
    return values if offset == 0 else values.shift(offset)


def _read_setting(source: Any, snake_key: str, camel_key: str, fallback: Any) -> Any:
    if isinstance(source, dict):
        return source.get(snake_key, source.get(camel_key, fallback))
    if hasattr(source, snake_key):
        return getattr(source, snake_key)
    return getattr(source, camel_key, fallback)


def _safe_float(value: Any, fallback: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _safe_optional_float(value: Any) -> float | None:
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    return out if pd.notna(out) else None


def _safe_int(value: Any, fallback: int, minimum: int, maximum: int) -> int:
    try:
        out = int(round(float(value)))
    except (TypeError, ValueError):
        return fallback
    return max(minimum, min(out, maximum))
