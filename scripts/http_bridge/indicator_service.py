from __future__ import annotations

from collections import OrderedDict
from pathlib import Path
from threading import RLock
from typing import Any

_MMF_RESULT_CACHE_MAX = 32
_MMF_V2_RESULT_CACHE_MAX = 64
_MMF_ENGINE_VERSION = "mmf_python_state_machine_v26_dedupe_extreme_windows"
_MMF_V2_SERVICE_CACHE_VERSION = "mmf_v2_service_cache_v2_support_resistance"
_MMF_INTERNAL_DPO_LENGTH = 21
_mmf_result_cache: OrderedDict[tuple[Any, ...], dict[str, Any]] = OrderedDict()
_mmf_v2_result_cache: OrderedDict[tuple[Any, ...], dict[str, Any]] = OrderedDict()
_cache_lock = RLock()


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
    with _cache_lock:
        cached = _mmf_result_cache.get(key)
        if cached is None:
            return None
        _mmf_result_cache.move_to_end(key)
        return cached


def _set_mmf_cached_result(key: tuple[Any, ...], value: dict[str, Any]) -> None:
    with _cache_lock:
        _mmf_result_cache[key] = value
        _mmf_result_cache.move_to_end(key)
        while len(_mmf_result_cache) > _MMF_RESULT_CACHE_MAX:
            _mmf_result_cache.popitem(last=False)


def _get_mmf_v2_cached_result(key: tuple[Any, ...]) -> dict[str, Any] | None:
    with _cache_lock:
        cached = _mmf_v2_result_cache.get(key)
        if cached is None:
            return None
        _mmf_v2_result_cache.move_to_end(key)
        return cached


def _set_mmf_v2_cached_result(key: tuple[Any, ...], value: dict[str, Any]) -> None:
    with _cache_lock:
        _mmf_v2_result_cache[key] = value
        _mmf_v2_result_cache.move_to_end(key)
        while len(_mmf_v2_result_cache) > _MMF_V2_RESULT_CACHE_MAX:
            _mmf_v2_result_cache.popitem(last=False)


def _mmf_v2_settings_cache_signature(settings: Any) -> tuple[Any, ...]:
    return (
        _MMF_V2_SERVICE_CACHE_VERSION,
        bool(getattr(settings, "show_high", True)),
        bool(getattr(settings, "show_low", True)),
        bool(getattr(settings, "show_support_level", False)),
        bool(getattr(settings, "show_resistance_level", False)),
        int(getattr(settings, "high_anchor_lookback_bars", 14)),
        int(getattr(settings, "low_anchor_lookback_bars", 14)),
        float(getattr(settings, "high_stoch_k_advance", 10)),
        float(getattr(settings, "low_stoch_k_advance", 10)),
        int(getattr(settings, "high_confirm_lookahead_bars", 7)),
        int(getattr(settings, "low_confirm_lookahead_bars", 7)),
        int(getattr(settings.stoch, "length", 28)),
        int(getattr(settings.stoch, "k_smoothing", 6)),
        int(getattr(settings.stoch, "d_smoothing", 6)),
        int(getattr(settings.vdo, "length", 14)),
        int(getattr(settings.vdo, "ema_smoothing", 0)),
        float(getattr(settings.vdo, "zero_line_value", 0.0)),
        float(getattr(settings.vdo, "up_line_value", 0.1)),
        float(getattr(settings.vdo, "up_line2_value", 0.05)),
        float(getattr(settings.vdo, "down_line_value", -0.1)),
        float(getattr(settings.vdo, "down_line2_value", -0.05)),
        int(getattr(settings.ma, "length", 20)),
        str(getattr(settings.ma, "ma_type", "sma")).lower(),
        str(getattr(settings.ma, "source", "close")).lower(),
        str(getattr(settings.morgan, "anchor", "h4")).lower(),
        tuple(float(value) for value in getattr(settings.morgan, "ratios", ())),
    )


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


def _normalize_mmf_v2_settings(payload: dict[str, Any]) -> "MmfV2Settings":
    from python.indicators.mmf_v2 import MmfV2Settings
    from python.indicators.mmf_v2.models import MmfV2MaSettings, MmfV2MorganSettings, MmfV2StochSettings, MmfV2VdoSettings

    settings_payload = payload.get("settings") if isinstance(payload.get("settings"), dict) else {}
    stoch_payload = settings_payload.get("stoch") if isinstance(settings_payload.get("stoch"), dict) else {}
    vdo_payload = settings_payload.get("vdo") if isinstance(settings_payload.get("vdo"), dict) else {}
    ma_payload = settings_payload.get("ma") if isinstance(settings_payload.get("ma"), dict) else {}
    morgan_payload = settings_payload.get("morgan") if isinstance(settings_payload.get("morgan"), dict) else {}
    ratios_payload = morgan_payload.get("ratios")
    ratios = tuple(_safe_float(value, 0) for value in ratios_payload) if isinstance(ratios_payload, list) else (-0.236, -0.118, 0.118, 0.236)
    ratios = tuple(value for value in ratios if value != 0) or (-0.236, -0.118, 0.118, 0.236)

    return MmfV2Settings(
        show_high=_safe_bool(settings_payload.get("showHigh"), True),
        show_low=_safe_bool(settings_payload.get("showLow"), True),
        show_support_level=_safe_bool(settings_payload.get("showSupportLevel"), False),
        show_resistance_level=_safe_bool(settings_payload.get("showResistanceLevel"), False),
        high_anchor_lookback_bars=_safe_int(settings_payload.get("highAnchorLookbackBars"), 14, minimum=1, maximum=200),
        low_anchor_lookback_bars=_safe_int(settings_payload.get("lowAnchorLookbackBars"), 14, minimum=1, maximum=200),
        high_stoch_k_advance=max(0, min(_safe_float(settings_payload.get("highStochKAdvance"), 10), 100)),
        low_stoch_k_advance=max(0, min(_safe_float(settings_payload.get("lowStochKAdvance"), 10), 100)),
        high_confirm_lookahead_bars=_safe_int(settings_payload.get("highConfirmLookaheadBars"), 7, minimum=1, maximum=200),
        low_confirm_lookahead_bars=_safe_int(settings_payload.get("lowConfirmLookaheadBars"), 7, minimum=1, maximum=200),
        stoch=MmfV2StochSettings(
            length=_safe_int(stoch_payload.get("length"), 28),
            k_smoothing=_safe_int(stoch_payload.get("kSmoothing") or stoch_payload.get("k_smoothing"), 6),
            d_smoothing=_safe_int(stoch_payload.get("dSmoothing") or stoch_payload.get("d_smoothing"), 6),
        ),
        vdo=MmfV2VdoSettings(
            length=_safe_int(vdo_payload.get("length"), 14),
            ema_smoothing=_safe_int(vdo_payload.get("emaSmoothing") or vdo_payload.get("ema_smoothing"), 0, minimum=0),
            zero_line_value=_safe_float(vdo_payload.get("zeroLineValue") or vdo_payload.get("zero_line_value"), 0),
            up_line_value=_safe_float(vdo_payload.get("upLineValue") or vdo_payload.get("up_line_value"), 0.1),
            up_line2_value=_safe_float(vdo_payload.get("upLine2Value") or vdo_payload.get("up_line2_value"), 0.05),
            down_line_value=_safe_float(vdo_payload.get("downLineValue") or vdo_payload.get("down_line_value"), -0.1),
            down_line2_value=_safe_float(vdo_payload.get("downLine2Value") or vdo_payload.get("down_line2_value"), -0.05),
        ),
        ma=MmfV2MaSettings(
            length=_safe_int(ma_payload.get("length"), 20),
            ma_type=str(ma_payload.get("type") or ma_payload.get("maType") or "sma"),
            source=str(ma_payload.get("source") or "close"),
        ),
        morgan=MmfV2MorganSettings(
            anchor=str(morgan_payload.get("anchor") or "h4"),
            ratios=ratios,
        ),
    )


def calculate_mmf_v2_indicator_from_rows(payload: dict[str, Any]) -> dict[str, Any]:
    from python.indicators.mmf_v2 import calculate_mmf_v2_markers

    rows = payload.get("rows")
    if not isinstance(rows, list):
        return {"ok": False, "status": "bad_request", "error": "rows_required", "markers": [], "markersCount": 0}

    settings = _normalize_mmf_v2_settings(payload)
    cache_key = (
        "provided_rows_v2",
        payload.get("symbol"),
        payload.get("timeframe"),
        _rows_cache_signature(rows),
        _mmf_v2_settings_cache_signature(settings),
        bool(_safe_bool(payload.get("includeDebug"), False)),
    )
    cached_result = _get_mmf_v2_cached_result(cache_key)
    cache_hit = cached_result is not None
    result = cached_result if cached_result is not None else calculate_mmf_v2_markers(
        rows,
        settings,
        include_debug=_safe_bool(payload.get("includeDebug"), False),
    )
    if cached_result is None:
        _set_mmf_v2_cached_result(cache_key, result)

    return {
        **result,
        "status": "ok",
        "symbol": payload.get("symbol"),
        "timeframe": payload.get("timeframe"),
        "mode": "provided_rows",
        "metadata": {
            "indicator": "MMF_V2",
            "engine": result.get("engine"),
            "cacheHit": cache_hit,
            "source": "provided_rows",
        },
    }
