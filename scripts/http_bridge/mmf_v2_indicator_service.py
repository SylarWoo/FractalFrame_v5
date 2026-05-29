from __future__ import annotations

from collections import OrderedDict
from threading import RLock
from typing import Any

_MMF_V2_RESULT_CACHE_MAX = 64
_MMF_V2_SERVICE_CACHE_VERSION = "mmf_v2_service_cache_v8_trend_divergence"
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
        bool(getattr(settings, "show_expected_support_level", False)),
        bool(getattr(settings, "show_expected_resistance_level", False)),
        bool(getattr(settings, "show_trend_down_rebound_point", False)),
        bool(getattr(settings, "show_trend_up_pullback_point", False)),
        bool(getattr(settings, "show_trend_down_return_point", False)),
        bool(getattr(settings, "show_trend_up_return_point", False)),
        float(getattr(settings, "trend_down_return_morgan_ratio", 0.25)),
        float(getattr(settings, "trend_up_return_morgan_ratio", 0.25)),
        bool(getattr(settings, "show_trend_down_divergence_point", False)),
        bool(getattr(settings, "show_trend_up_divergence_point", False)),
        float(getattr(settings, "trend_down_divergence_morgan_ratio", 0.375)),
        float(getattr(settings, "trend_up_divergence_morgan_ratio", 0.375)),
        bool(getattr(settings, "show_support_down_break_point", False)),
        bool(getattr(settings, "show_support_up_break_point", False)),
        bool(getattr(settings, "show_resistance_down_break_point", False)),
        bool(getattr(settings, "show_resistance_up_break_point", False)),
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
        int(getattr(settings.ma, "length", 120)),
        str(getattr(settings.ma, "ma_type", "sma")).lower(),
        str(getattr(settings.ma, "source", "hlc3")).lower(),
        str(getattr(settings.morgan, "anchor", "h4")).lower(),
        tuple(float(value) for value in getattr(settings.morgan, "ratios", ())),
    )


def _normalize_mmf_v2_settings(payload: dict[str, Any]) -> "MmfV2Settings":
    from python.indicators.mmf_v2 import MmfV2Settings
    from python.indicators.mmf_v2.models import MmfV2MaSettings, MmfV2MorganSettings, MmfV2StochSettings, MmfV2VdoSettings

    settings_payload = payload.get("settings") if isinstance(payload.get("settings"), dict) else {}
    stoch_payload = settings_payload.get("stoch") if isinstance(settings_payload.get("stoch"), dict) else {}
    vdo_payload = settings_payload.get("vdo") if isinstance(settings_payload.get("vdo"), dict) else {}
    morgan_payload = settings_payload.get("morgan") if isinstance(settings_payload.get("morgan"), dict) else {}
    ratios_payload = morgan_payload.get("ratios")
    ratios = tuple(_safe_float(value, 0) for value in ratios_payload) if isinstance(ratios_payload, list) else (-0.236, -0.118, 0.118, 0.236)
    ratios = tuple(value for value in ratios if value != 0) or (-0.236, -0.118, 0.118, 0.236)

    return MmfV2Settings(
        show_high=_safe_bool(settings_payload.get("showHigh"), True),
        show_low=_safe_bool(settings_payload.get("showLow"), True),
        show_support_level=_safe_bool(settings_payload.get("showSupportLevel"), False),
        show_resistance_level=_safe_bool(settings_payload.get("showResistanceLevel"), False),
        show_expected_support_level=_safe_bool(settings_payload.get("showExpectedSupportLevel"), False),
        show_expected_resistance_level=_safe_bool(settings_payload.get("showExpectedResistanceLevel"), False),
        show_trend_down_rebound_point=_safe_bool(settings_payload.get("showTrendDownReboundPoint"), False),
        show_trend_up_pullback_point=_safe_bool(settings_payload.get("showTrendUpPullbackPoint"), False),
        show_trend_down_return_point=_safe_bool(settings_payload.get("showTrendDownReturnPoint"), False),
        show_trend_up_return_point=_safe_bool(settings_payload.get("showTrendUpReturnPoint"), False),
        show_trend_down_divergence_point=_safe_bool(settings_payload.get("showTrendDownDivergencePointV2"), False),
        show_trend_up_divergence_point=_safe_bool(settings_payload.get("showTrendUpDivergencePointV2"), False),
        show_support_down_break_point=_safe_bool(settings_payload.get("showSupportDownBreakPoint"), False),
        show_support_up_break_point=_safe_bool(settings_payload.get("showSupportUpBreakPoint"), False),
        show_resistance_down_break_point=_safe_bool(settings_payload.get("showResistanceDownBreakPoint"), False),
        show_resistance_up_break_point=_safe_bool(settings_payload.get("showResistanceUpBreakPoint"), False),
        high_anchor_lookback_bars=_safe_int(settings_payload.get("highAnchorLookbackBars"), 14, minimum=1, maximum=200),
        low_anchor_lookback_bars=_safe_int(settings_payload.get("lowAnchorLookbackBars"), 14, minimum=1, maximum=200),
        high_stoch_k_advance=max(0, min(_safe_float(settings_payload.get("highStochKAdvance"), 10), 100)),
        low_stoch_k_advance=max(0, min(_safe_float(settings_payload.get("lowStochKAdvance"), 10), 100)),
        trend_down_return_morgan_ratio=max(0, min(_safe_float(settings_payload.get("trendDownReturnMorganRatio"), 0.25), 1)),
        trend_up_return_morgan_ratio=max(0, min(_safe_float(settings_payload.get("trendUpReturnMorganRatio"), 0.25), 1)),
        trend_down_divergence_morgan_ratio=max(0, min(_safe_float(settings_payload.get("trendDownDivergenceMorganRatio"), 0.375), 1)),
        trend_up_divergence_morgan_ratio=max(0, min(_safe_float(settings_payload.get("trendUpDivergenceMorganRatio"), 0.375), 1)),
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
        ma=MmfV2MaSettings(),
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
