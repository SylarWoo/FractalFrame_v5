from __future__ import annotations

from collections import OrderedDict
from pathlib import Path
from typing import Any

_MMF_RESULT_CACHE_MAX = 32
_MMF_ENGINE_VERSION = "mmf_python_state_machine_v17_stoch_zone_confirm_offset"
_MMF_INTERNAL_DPO_LENGTH = 21
_mmf_result_cache: OrderedDict[tuple[Any, ...], dict[str, Any]] = OrderedDict()


def _safe_float(value: Any, default: float) -> float:
    try:
        out = float(value)
    except (TypeError, ValueError):
        return default
    return out


def _safe_bool(value: Any, default: bool) -> bool:
    if value is None:
        return default
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "on"}:
        return True
    if text in {"0", "false", "no", "off"}:
        return False
    return default


def _safe_int(value: Any, default: int, minimum: int = 1, maximum: int = 500) -> int:
    try:
        out = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(minimum, min(out, maximum))


def _rows_cache_signature(rows: Any) -> tuple[Any, ...] | None:
    if not isinstance(rows, list):
        return None
    if not rows:
        return (0,)
    checksum = 0
    valid_rows = 0
    first_time: int | None = None
    last_time: int | None = None
    for row in rows:
        if not isinstance(row, dict):
            continue
        try:
            time = int(float(row.get("time")))
            open_value = round(float(row.get("open")), 5)
            high_value = round(float(row.get("high")), 5)
            low_value = round(float(row.get("low")), 5)
            close_value = round(float(row.get("close")), 5)
        except (TypeError, ValueError):
            continue
        if first_time is None:
            first_time = time
        last_time = time
        valid_rows += 1
        checksum = (checksum + ((time % 1_000_000_007) * 3)) % 1_000_000_007
        checksum = (checksum + int(open_value * 10_000) * 5) % 1_000_000_007
        checksum = (checksum + int(high_value * 10_000) * 7) % 1_000_000_007
        checksum = (checksum + int(low_value * 10_000) * 11) % 1_000_000_007
        checksum = (checksum + int(close_value * 10_000) * 13) % 1_000_000_007
    return (valid_rows, first_time, last_time, checksum)


def _settings_cache_signature(settings: "MmfSettings") -> tuple[Any, ...]:
    return (
        _MMF_ENGINE_VERSION,
        settings.dpo_value,
        settings.show_high,
        settings.show_low,
        settings.high_morgan_ratio,
        settings.high_offset_percent,
        settings.low_dpo_value,
        settings.low_morgan_ratio,
        settings.low_offset_percent,
        settings.stoch_length,
        settings.stoch_k_smoothing,
        settings.stoch_d_smoothing,
        _MMF_INTERNAL_DPO_LENGTH,
    )


def _get_mmf_cached_result(key: tuple[Any, ...]) -> dict[str, Any] | None:
    cached = _mmf_result_cache.get(key)
    if cached is None:
        return None
    _mmf_result_cache.move_to_end(key)
    return cached


def _set_mmf_cached_result(key: tuple[Any, ...], value: dict[str, Any]) -> None:
    _mmf_result_cache[key] = value
    _mmf_result_cache.move_to_end(key)
    while len(_mmf_result_cache) > _MMF_RESULT_CACHE_MAX:
        _mmf_result_cache.popitem(last=False)


def query_mmf_indicator(params: dict[str, list[str]], store_root: Path | None = None) -> dict[str, Any]:
    from python.indicators.mmf_indicator import MmfSettings, calculate_mmf_high_markers

    from .store_v5_operations_service import query_store_v5_ohlcv

    dpo_value = _safe_float((params.get("dpoValue") or params.get("dpo_value") or ["11"])[0], 11)
    show_high = _safe_bool((params.get("showHigh") or params.get("show_high") or ["1"])[0], True)
    show_low = _safe_bool((params.get("showLow") or params.get("show_low") or ["1"])[0], True)
    high_morgan_ratio = _safe_float((params.get("highMorganRatio") or params.get("high_morgan_ratio") or ["0.118"])[0], 0.118)
    high_offset_percent = _safe_float((params.get("highOffsetPercent") or params.get("high_offset_percent") or ["0"])[0], 0)
    low_dpo_value = _safe_float((params.get("lowDpoValue") or params.get("low_dpo_value") or ["-11"])[0], -11)
    low_morgan_ratio = _safe_float((params.get("lowMorganRatio") or params.get("low_morgan_ratio") or ["-0.118"])[0], -0.118)
    low_offset_percent = _safe_float((params.get("lowOffsetPercent") or params.get("low_offset_percent") or ["0"])[0], 0)
    stoch_length = _safe_int((params.get("stochLength") or params.get("stoch_length") or ["14"])[0], 14)
    stoch_k_smoothing = _safe_int((params.get("stochKSmoothing") or params.get("stoch_k_smoothing") or ["3"])[0], 3)
    stoch_d_smoothing = _safe_int((params.get("stochDSmoothing") or params.get("stoch_d_smoothing") or ["3"])[0], 3)
    ohlcv_payload = query_store_v5_ohlcv(params, store_root=store_root)
    if ohlcv_payload.get("ok") is not True:
        return {
            "ok": False,
            "status": "ohlcv_query_failed",
            "error": ohlcv_payload.get("error") or "ohlcv_query_failed",
            "ohlcv": ohlcv_payload,
            "markers": [],
            "markersCount": 0,
        }

    settings = MmfSettings(
        show_high=show_high,
        show_low=show_low,
        dpo_value=dpo_value,
        high_morgan_ratio=high_morgan_ratio,
        high_offset_percent=high_offset_percent,
        low_dpo_value=low_dpo_value,
        low_morgan_ratio=low_morgan_ratio,
        low_offset_percent=low_offset_percent,
        stoch_length=stoch_length,
        stoch_k_smoothing=stoch_k_smoothing,
        stoch_d_smoothing=stoch_d_smoothing,
        dpo_length=_MMF_INTERNAL_DPO_LENGTH,
    )
    rows = ohlcv_payload.get("rows") or []
    cache_key = (
        "query",
        ohlcv_payload.get("symbol"),
        ohlcv_payload.get("timeframe"),
        _rows_cache_signature(rows),
        _settings_cache_signature(settings),
    )
    cached_result = _get_mmf_cached_result(cache_key)
    result = cached_result if cached_result is not None else calculate_mmf_high_markers(rows, settings)
    cache_hit = cached_result is not None
    if cached_result is None:
        _set_mmf_cached_result(cache_key, result)
    return {
        "ok": True,
        "status": "ok",
        "symbol": ohlcv_payload.get("symbol"),
        "timeframe": ohlcv_payload.get("timeframe"),
        "mode": ohlcv_payload.get("mode"),
        "rowsCount": result["rowsCount"],
        "markersCount": result["markersCount"],
        "markers": result["markers"],
        "metadata": {
            **(ohlcv_payload.get("metadata") if isinstance(ohlcv_payload.get("metadata"), dict) else {}),
            "indicator": "MMF",
            "engine": _MMF_ENGINE_VERSION,
            "cacheHit": cache_hit,
            "internalIndicators": {
                "dpoLength": _MMF_INTERNAL_DPO_LENGTH,
                "stochLength": settings.stoch_length,
                "stochKSmoothing": settings.stoch_k_smoothing,
                "stochDSmoothing": settings.stoch_d_smoothing,
            },
        },
    }


def calculate_mmf_indicator_from_rows(payload: dict[str, Any]) -> dict[str, Any]:
    from python.indicators.mmf_indicator import MmfSettings, calculate_mmf_high_markers

    rows = payload.get("rows")
    if not isinstance(rows, list):
        return {"ok": False, "status": "bad_request", "error": "rows_required", "markers": [], "markersCount": 0}

    settings_payload = payload.get("settings") if isinstance(payload.get("settings"), dict) else {}
    settings = MmfSettings(
        show_high=_safe_bool(settings_payload.get("showHigh"), True),
        show_low=_safe_bool(settings_payload.get("showLow"), True),
        dpo_value=_safe_float(settings_payload.get("dpoValue"), 11),
        high_morgan_ratio=_safe_float(settings_payload.get("highMorganRatio"), 0.118),
        high_offset_percent=_safe_float(settings_payload.get("highOffsetPercent"), 0),
        low_dpo_value=_safe_float(settings_payload.get("lowDpoValue"), -11),
        low_morgan_ratio=_safe_float(settings_payload.get("lowMorganRatio"), -0.118),
        low_offset_percent=_safe_float(settings_payload.get("lowOffsetPercent"), 0),
        stoch_length=_safe_int(settings_payload.get("stochLength"), 14),
        stoch_k_smoothing=_safe_int(settings_payload.get("stochKSmoothing"), 3),
        stoch_d_smoothing=_safe_int(settings_payload.get("stochDSmoothing"), 3),
        dpo_length=_MMF_INTERNAL_DPO_LENGTH,
    )
    cache_key = (
        "provided_rows",
        payload.get("symbol"),
        payload.get("timeframe"),
        _rows_cache_signature(rows),
        _settings_cache_signature(settings),
    )
    cached_result = _get_mmf_cached_result(cache_key)
    result = cached_result if cached_result is not None else calculate_mmf_high_markers(rows, settings)
    cache_hit = cached_result is not None
    if cached_result is None:
        _set_mmf_cached_result(cache_key, result)
    return {
        "ok": True,
        "status": "ok",
        "symbol": payload.get("symbol"),
        "timeframe": payload.get("timeframe"),
        "mode": "provided_rows",
        "rowsCount": result["rowsCount"],
        "markersCount": result["markersCount"],
        "markers": result["markers"],
        "metadata": {
            "indicator": "MMF",
            "engine": _MMF_ENGINE_VERSION,
            "cacheHit": cache_hit,
            "source": "provided_rows",
            "internalIndicators": {
                "dpoLength": _MMF_INTERNAL_DPO_LENGTH,
                "stochLength": settings.stoch_length,
                "stochKSmoothing": settings.stoch_k_smoothing,
                "stochDSmoothing": settings.stoch_d_smoothing,
            },
        },
    }
