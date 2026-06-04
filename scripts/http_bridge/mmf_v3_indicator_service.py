from __future__ import annotations

import hashlib
import json
from collections import OrderedDict
from threading import RLock, Thread
from time import time
from typing import Any
from uuid import uuid4

_MMF_V3_RESULT_CACHE_MAX = 64
_MMF_V3_FEATURE_CACHE_MAX = 32
_MMF_V3_JOB_MAX = 64
_MMF_V3_SERVICE_CACHE_VERSION = "mmf_v3_service_cache_v53_vmi_zero_sr"
_mmf_v3_result_cache: OrderedDict[tuple[Any, ...], dict[str, Any]] = OrderedDict()
_mmf_v3_feature_cache: OrderedDict[tuple[Any, ...], tuple[Any, dict[str, Any]]] = OrderedDict()
_mmf_v3_jobs: OrderedDict[str, dict[str, Any]] = OrderedDict()
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


def _first_present(payload: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in payload:
            return payload.get(key)
    return None


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


def _get_mmf_v3_cached_result(key: tuple[Any, ...]) -> dict[str, Any] | None:
    with _cache_lock:
        cached = _mmf_v3_result_cache.get(key)
        if cached is None:
            return None
        _mmf_v3_result_cache.move_to_end(key)
        return cached


def _set_mmf_v3_cached_result(key: tuple[Any, ...], value: dict[str, Any]) -> None:
    with _cache_lock:
        _mmf_v3_result_cache[key] = value
        _mmf_v3_result_cache.move_to_end(key)
        while len(_mmf_v3_result_cache) > _MMF_V3_RESULT_CACHE_MAX:
            _mmf_v3_result_cache.popitem(last=False)


def _get_mmf_v3_cached_feature(key: tuple[Any, ...]) -> tuple[Any, dict[str, Any]] | None:
    with _cache_lock:
        cached = _mmf_v3_feature_cache.get(key)
        if cached is None:
            return None
        _mmf_v3_feature_cache.move_to_end(key)
        return cached


def _set_mmf_v3_cached_feature(key: tuple[Any, ...], value: tuple[Any, dict[str, Any]]) -> None:
    with _cache_lock:
        _mmf_v3_feature_cache[key] = value
        _mmf_v3_feature_cache.move_to_end(key)
        while len(_mmf_v3_feature_cache) > _MMF_V3_FEATURE_CACHE_MAX:
            _mmf_v3_feature_cache.popitem(last=False)


def _set_mmf_v3_job(job_id: str, payload: dict[str, Any]) -> None:
    with _cache_lock:
        _mmf_v3_jobs[job_id] = payload
        _mmf_v3_jobs.move_to_end(job_id)
        while len(_mmf_v3_jobs) > _MMF_V3_JOB_MAX:
            _mmf_v3_jobs.popitem(last=False)


def get_mmf_v3_indicator_job(job_id: str) -> dict[str, Any]:
    with _cache_lock:
        job = _mmf_v3_jobs.get(job_id)
        if job is None:
            return {"ok": False, "status": "job_not_found", "error": "job_not_found", "jobId": job_id}
        _mmf_v3_jobs.move_to_end(job_id)
        return dict(job)


def _mmf_v3_settings_cache_signature(settings: Any) -> tuple[Any, ...]:
    return (
        _MMF_V3_SERVICE_CACHE_VERSION,
        bool(getattr(settings, "show_high", True)),
        bool(getattr(settings, "show_low", True)),
        bool(getattr(settings, "show_support_level", False)),
        bool(getattr(settings, "show_resistance_level", False)),
        bool(getattr(settings, "show_top_divergence_point", False)),
        bool(getattr(settings, "show_bottom_divergence_point", False)),
        bool(getattr(settings, "show_trend_down_rebound_point", False)),
        bool(getattr(settings, "show_trend_up_pullback_point", False)),
        False,
        False,
        False,
        False,
        0.0,
        0.0,
        False,
        False,
        0.0,
        0.0,
        False,
        False,
        False,
        False,
        False,
        False,
        bool(getattr(settings, "show_bull_market_point", False)),
        bool(getattr(settings, "show_bear_market_point", False)),
        bool(getattr(settings, "show_overbought_point", False)),
        bool(getattr(settings, "show_overbought_close_point", False)),
        bool(getattr(settings, "show_oversold_point", False)),
        bool(getattr(settings, "show_oversold_close_point", False)),
        bool(getattr(settings, "show_tsi_dead_cross_point", False)),
        bool(getattr(settings, "show_tsi_dead_cross_confirm_point", False)),
        float(getattr(settings, "tsi_dead_cross_confirm_distance", 5.0)),
        bool(getattr(settings, "show_tsi_golden_cross_point", False)),
        bool(getattr(settings, "show_tsi_golden_cross_confirm_point", False)),
        bool(getattr(settings, "show_bpr_m5_strategy", False)),
        float(getattr(settings, "tsi_golden_cross_confirm_distance", 5.0)),
        0.0,
        0.0,
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
        float(getattr(settings.vdo, "up_line3_value", 0.16)),
        float(getattr(settings.vdo, "down_line_value", -0.1)),
        float(getattr(settings.vdo, "down_line2_value", -0.05)),
        float(getattr(settings.vdo, "down_line3_value", -0.16)),
        int(getattr(settings.vdo, "vdo_base_ma_length", 14)),
        int(getattr(settings.vdo, "vdo_base2_ma_length", 34)),
        int(getattr(settings.vmi, "fast_length", 5)),
        int(getattr(settings.vmi, "slow_length", 34)),
        int(getattr(settings.tsi, "long_length", 25)),
        int(getattr(settings.tsi, "short_length", 13)),
        int(getattr(settings.tsi, "signal_length", 13)),
        int(getattr(settings.ma, "length", 120)),
        str(getattr(settings.ma, "ma_type", "sma")).lower(),
        str(getattr(settings.ma, "source", "hlc3")).lower(),
        str(getattr(settings.vwap, "anchor_period", "session")).lower(),
        str(getattr(settings.vwap, "source", "hlc3")).lower(),
        str(getattr(settings.vwap, "band_calculation_mode", "standard_deviation")).lower(),
        float(getattr(settings.vwap, "band1_multiplier", 1.0)),
        int(getattr(settings.vwap, "offset", 0)),
        str(getattr(settings.vwap, "symbol", "")).upper(),
        str(getattr(settings.morgan, "anchor", "h4")).lower(),
        tuple(float(value) for value in getattr(settings.morgan, "ratios", ())),
    )


def _mmf_v3_feature_settings_payload(settings: Any) -> dict[str, Any]:
    return {
        "stoch": {
            "length": int(getattr(settings.stoch, "length", 28)),
            "kSmoothing": int(getattr(settings.stoch, "k_smoothing", 6)),
            "dSmoothing": int(getattr(settings.stoch, "d_smoothing", 6)),
        },
        "vdo": {
            "length": int(getattr(settings.vdo, "length", 14)),
            "emaSmoothing": int(getattr(settings.vdo, "ema_smoothing", 0)),
            "zeroLineValue": float(getattr(settings.vdo, "zero_line_value", 0.0)),
            "upLineValue": float(getattr(settings.vdo, "up_line_value", 0.1)),
            "upLine2Value": float(getattr(settings.vdo, "up_line2_value", 0.05)),
            "upLine3Value": float(getattr(settings.vdo, "up_line3_value", 0.16)),
            "downLineValue": float(getattr(settings.vdo, "down_line_value", -0.1)),
            "downLine2Value": float(getattr(settings.vdo, "down_line2_value", -0.05)),
            "downLine3Value": float(getattr(settings.vdo, "down_line3_value", -0.16)),
            "vdoMaLength": int(getattr(settings.vdo, "vdo_base_ma_length", 14)),
            "vdoMa2Length": int(getattr(settings.vdo, "vdo_base2_ma_length", 34)),
        },
        "vmi": {
            "fastLength": int(getattr(settings.vmi, "fast_length", 5)),
            "slowLength": int(getattr(settings.vmi, "slow_length", 34)),
        },
        "tsi": {
            "longLength": int(getattr(settings.tsi, "long_length", 25)),
            "shortLength": int(getattr(settings.tsi, "short_length", 13)),
            "signalLength": int(getattr(settings.tsi, "signal_length", 13)),
        },
        "ma": {
            "length": int(getattr(settings.ma, "length", 120)),
            "type": str(getattr(settings.ma, "ma_type", "sma")).lower(),
            "source": str(getattr(settings.ma, "source", "hlc3")).lower(),
        },
        "vwap": {
            "anchorPeriod": str(getattr(settings.vwap, "anchor_period", "session")).lower(),
            "source": str(getattr(settings.vwap, "source", "hlc3")).lower(),
            "bandCalculationMode": str(getattr(settings.vwap, "band_calculation_mode", "standard_deviation")).lower(),
            "band1Multiplier": float(getattr(settings.vwap, "band1_multiplier", 1.0)),
            "offset": int(getattr(settings.vwap, "offset", 0)),
            "symbol": str(getattr(settings.vwap, "symbol", "")),
        },
        "morgan": {
            "anchor": str(getattr(settings.morgan, "anchor", "h4")).lower(),
            "ratios": [float(value) for value in getattr(settings.morgan, "ratios", ())],
        },
    }


def _feature_settings_hash(settings: Any) -> str:
    payload = _mmf_v3_feature_settings_payload(settings)
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


def _normalize_mmf_v3_settings(payload: dict[str, Any]) -> "MmfV3Settings":
    from python.indicators.mmf_v3 import MmfV3Settings
    from python.indicators.mmf_v3.models import MmfV3MaSettings, MmfV3MorganSettings, MmfV3StochSettings, MmfV3TsiSettings, MmfV3VdoSettings, MmfV3VmiSettings, MmfV3VwapSettings

    settings_payload = payload.get("settings") if isinstance(payload.get("settings"), dict) else {}
    stoch_payload = settings_payload.get("stoch") if isinstance(settings_payload.get("stoch"), dict) else {}
    vdo_payload = settings_payload.get("vdo") if isinstance(settings_payload.get("vdo"), dict) else {}
    vmi_payload = settings_payload.get("vmi") if isinstance(settings_payload.get("vmi"), dict) else {}
    tsi_payload = settings_payload.get("tsi") if isinstance(settings_payload.get("tsi"), dict) else {}
    ma_payload = settings_payload.get("ma") if isinstance(settings_payload.get("ma"), dict) else {}
    vwap_payload = settings_payload.get("vwap") if isinstance(settings_payload.get("vwap"), dict) else {}
    morgan_payload = settings_payload.get("morgan") if isinstance(settings_payload.get("morgan"), dict) else {}
    strategies_payload = settings_payload.get("strategies") if isinstance(settings_payload.get("strategies"), dict) else {}
    ratios_payload = morgan_payload.get("ratios")
    ratios = tuple(_safe_float(value, 0) for value in ratios_payload) if isinstance(ratios_payload, list) else (-0.236, -0.118, 0.118, 0.236)
    ratios = tuple(value for value in ratios if value != 0) or (-0.236, -0.118, 0.118, 0.236)

    return MmfV3Settings(
        show_high=_safe_bool(settings_payload.get("showHigh"), True),
        show_low=_safe_bool(settings_payload.get("showLow"), True),
        show_support_level=_safe_bool(settings_payload.get("showSupportLevel"), False),
        show_resistance_level=_safe_bool(settings_payload.get("showResistanceLevel"), False),
        show_top_divergence_point=_safe_bool(_first_present(settings_payload, "showTopDivergencePointV2", "showTopDivergencePoint"), False),
        show_bottom_divergence_point=_safe_bool(_first_present(settings_payload, "showBottomDivergencePointV2", "showBottomDivergencePoint"), False),
        show_expected_support_level=False,
        show_expected_resistance_level=False,
        show_trend_down_rebound_point=_safe_bool(settings_payload.get("showTrendDownReboundPoint"), False),
        show_trend_up_pullback_point=_safe_bool(settings_payload.get("showTrendUpPullbackPoint"), False),
        show_trend_down_return_point=False,
        show_trend_up_return_point=False,
        show_trend_down_divergence_point=False,
        show_trend_up_divergence_point=False,
        show_support_down_break_point=False,
        show_support_up_break_point=False,
        show_resistance_down_break_point=False,
        show_resistance_up_break_point=False,
        show_true_close_down_point=False,
        show_true_close_up_point=False,
        show_bull_market_point=_safe_bool(settings_payload.get("showBullMarketPoint"), False),
        show_bear_market_point=_safe_bool(settings_payload.get("showBearMarketPoint"), False),
        show_overbought_point=_safe_bool(settings_payload.get("showOverboughtPoint"), False),
        show_overbought_close_point=_safe_bool(settings_payload.get("showOverboughtClosePoint"), False),
        show_oversold_point=_safe_bool(settings_payload.get("showOversoldPoint"), False),
        show_oversold_close_point=_safe_bool(settings_payload.get("showOversoldClosePoint"), False),
        show_tsi_dead_cross_point=_safe_bool(settings_payload.get("showTsiDeadCrossPoint"), False),
        show_tsi_dead_cross_confirm_point=_safe_bool(settings_payload.get("showTsiDeadCrossConfirmPoint"), False),
        show_tsi_golden_cross_point=_safe_bool(settings_payload.get("showTsiGoldenCrossPoint"), False),
        show_tsi_golden_cross_confirm_point=_safe_bool(settings_payload.get("showTsiGoldenCrossConfirmPoint"), False),
        show_bpr_m5_strategy=_safe_bool(strategies_payload.get("bprM5") or settings_payload.get("showBprM5Strategy"), False),
        tsi_dead_cross_confirm_distance=max(0, _safe_float(settings_payload.get("tsiDeadCrossConfirmDistance"), 5.0)),
        tsi_golden_cross_confirm_distance=max(0, _safe_float(settings_payload.get("tsiGoldenCrossConfirmDistance"), 5.0)),
        true_close_down_vdo_threshold=0.0,
        true_close_up_vdo_threshold=0.0,
        high_anchor_lookback_bars=_safe_int(settings_payload.get("highAnchorLookbackBars"), 14, minimum=1, maximum=200),
        low_anchor_lookback_bars=_safe_int(settings_payload.get("lowAnchorLookbackBars"), 14, minimum=1, maximum=200),
        high_stoch_k_advance=max(0, min(_safe_float(settings_payload.get("highStochKAdvance"), 10), 100)),
        low_stoch_k_advance=max(0, min(_safe_float(settings_payload.get("lowStochKAdvance"), 10), 100)),
        trend_down_return_morgan_ratio=0.0,
        trend_up_return_morgan_ratio=0.0,
        trend_down_divergence_morgan_ratio=0.0,
        trend_up_divergence_morgan_ratio=0.0,
        high_confirm_lookahead_bars=_safe_int(settings_payload.get("highConfirmLookaheadBars"), 7, minimum=1, maximum=200),
        low_confirm_lookahead_bars=_safe_int(settings_payload.get("lowConfirmLookaheadBars"), 7, minimum=1, maximum=200),
        stoch=MmfV3StochSettings(
            length=_safe_int(stoch_payload.get("length"), 28),
            k_smoothing=_safe_int(stoch_payload.get("kSmoothing") or stoch_payload.get("k_smoothing"), 6),
            d_smoothing=_safe_int(stoch_payload.get("dSmoothing") or stoch_payload.get("d_smoothing"), 6),
        ),
        vdo=MmfV3VdoSettings(
            length=_safe_int(vdo_payload.get("length"), 14),
            ema_smoothing=_safe_int(vdo_payload.get("emaSmoothing") or vdo_payload.get("ema_smoothing"), 0, minimum=0),
            zero_line_value=_safe_float(vdo_payload.get("zeroLineValue") or vdo_payload.get("zero_line_value"), 0),
            up_line_value=_safe_float(vdo_payload.get("upLineValue") or vdo_payload.get("up_line_value"), 0.1),
            up_line2_value=_safe_float(vdo_payload.get("upLine2Value") or vdo_payload.get("up_line2_value"), 0.05),
            up_line3_value=_safe_float(vdo_payload.get("upLine3Value") or vdo_payload.get("up_line3_value"), 0.16),
            down_line_value=_safe_float(vdo_payload.get("downLineValue") or vdo_payload.get("down_line_value"), -0.1),
            down_line2_value=_safe_float(vdo_payload.get("downLine2Value") or vdo_payload.get("down_line2_value"), -0.05),
            down_line3_value=_safe_float(vdo_payload.get("downLine3Value") or vdo_payload.get("down_line3_value"), -0.16),
            vdo_base_ma_length=_safe_int(vdo_payload.get("vdoMaLength") or vdo_payload.get("vdo_base_ma_length"), 14, minimum=1, maximum=500),
            vdo_base2_ma_length=_safe_int(vdo_payload.get("vdoMa2Length") or vdo_payload.get("vdo_base2_ma_length"), 34, minimum=1, maximum=500),
        ),
        vmi=MmfV3VmiSettings(
            fast_length=_safe_int(vmi_payload.get("fastLength") or vmi_payload.get("fast_length"), 5, minimum=1, maximum=500),
            slow_length=_safe_int(vmi_payload.get("slowLength") or vmi_payload.get("slow_length"), 34, minimum=1, maximum=500),
        ),
        tsi=MmfV3TsiSettings(
            long_length=_safe_int(tsi_payload.get("longLength") or tsi_payload.get("long_length"), 25, minimum=1, maximum=500),
            short_length=_safe_int(tsi_payload.get("shortLength") or tsi_payload.get("short_length"), 13, minimum=1, maximum=500),
            signal_length=_safe_int(tsi_payload.get("signalLength") or tsi_payload.get("signal_length"), 13, minimum=1, maximum=500),
        ),
        ma=MmfV3MaSettings(
            length=_safe_int(ma_payload.get("length"), 120, minimum=1, maximum=5000),
            ma_type=str(ma_payload.get("type") or ma_payload.get("maType") or ma_payload.get("ma_type") or "sma"),
            source=str(ma_payload.get("source") or "hlc3"),
        ),
        morgan=MmfV3MorganSettings(
            anchor=str(morgan_payload.get("anchor") or "h4"),
            ratios=ratios,
        ),
        vwap=MmfV3VwapSettings(
            anchor_period=str(vwap_payload.get("anchorPeriod") or vwap_payload.get("anchor_period") or "session"),
            source=str(vwap_payload.get("source") or "hlc3"),
            band_calculation_mode=str(vwap_payload.get("bandCalculationMode") or vwap_payload.get("band_calculation_mode") or "standard_deviation"),
            band1_multiplier=_safe_float(vwap_payload.get("band1Multiplier") or vwap_payload.get("band1_multiplier"), 1.0),
            offset=_safe_int(vwap_payload.get("offset"), 0, minimum=-5000, maximum=5000),
            symbol=str(vwap_payload.get("symbol") or payload.get("symbol") or ""),
        ),
    )


def calculate_mmf_v3_indicator_from_rows(payload: dict[str, Any]) -> dict[str, Any]:
    rows = payload.get("rows")
    if not isinstance(rows, list):
        return {"ok": False, "status": "bad_request", "error": "rows_required", "markers": [], "markersCount": 0}

    settings = _normalize_mmf_v3_settings(payload)
    return _calculate_mmf_v3_indicator_from_rows_with_settings(payload, rows, settings)


def _calculate_mmf_v3_indicator_from_rows_with_settings(payload: dict[str, Any], rows: list[Any], settings: Any) -> dict[str, Any]:
    cache_key = (
        "provided_rows_v2",
        payload.get("symbol"),
        payload.get("timeframe"),
        _rows_cache_signature(rows),
        _mmf_v3_settings_cache_signature(settings),
        bool(_safe_bool(payload.get("includeDebug"), False)),
        bool(_safe_bool(payload.get("includeSignalFrame"), True)),
    )
    cached_result = _get_mmf_v3_cached_result(cache_key)
    cache_hit = cached_result is not None
    result = cached_result if cached_result is not None else _build_mmf_v3_compute_result(payload, rows, settings)
    if cached_result is None:
        _set_mmf_v3_cached_result(cache_key, result)

    return {
        **result,
        "status": "ok",
        "symbol": payload.get("symbol"),
        "timeframe": payload.get("timeframe"),
        "mode": "provided_rows",
        "metadata": {
            "indicator": "MMF_V3",
            "engine": result.get("engine"),
            "cacheHit": cache_hit,
            "source": "provided_rows",
            "featureSettings": _mmf_v3_feature_settings_payload(settings),
            "featureSettingsHash": _feature_settings_hash(settings),
            "computeMode": "feature_signal_cache",
        },
    }


def _build_mmf_v3_compute_result(payload: dict[str, Any], rows: list[Any], settings: Any) -> dict[str, Any]:
    from python.indicators.mmf_v3 import calculate_mmf_v3_markers_from_features
    from python.indicators.mmf_v3.feature_frame import build_mmf_v3_feature_frame
    from python.indicators.mmf_v3.features import normalize_ohlcv_frame
    from python.market_data import create_bar_alignment_debug

    row_signature = _rows_cache_signature(rows)
    feature_key = (
        "feature_frame_v2_vdo_inner_entry",
        payload.get("symbol"),
        payload.get("timeframe"),
        row_signature,
        _feature_settings_hash(settings),
    )
    cached_feature = _get_mmf_v3_cached_feature(feature_key)
    feature_cache_hit = cached_feature is not None
    if cached_feature is None:
        frame = normalize_ohlcv_frame(rows)
        alignment_debug = create_bar_alignment_debug(rows, frame)
        feature_frame = build_mmf_v3_feature_frame(frame, settings).frame
        cached_feature = (feature_frame, alignment_debug)
        _set_mmf_v3_cached_feature(feature_key, cached_feature)

    features, alignment_debug = cached_feature
    result = calculate_mmf_v3_markers_from_features(
        features,
        settings,
        alignment_debug=alignment_debug,
        include_debug=_safe_bool(payload.get("includeDebug"), False),
        include_signal_frame=_safe_bool(payload.get("includeSignalFrame"), True),
    )
    metadata = result.get("metadata") if isinstance(result.get("metadata"), dict) else {}
    return {
        **result,
        "metadata": {
            **metadata,
            "featureCacheHit": feature_cache_hit,
            "featureCacheKey": hashlib.sha256(json.dumps(feature_key, sort_keys=True, default=str).encode("utf-8")).hexdigest()[:16],
        },
    }


def start_mmf_v3_indicator_job(payload: dict[str, Any]) -> dict[str, Any]:
    rows = payload.get("rows")
    if not isinstance(rows, list):
        return {"ok": False, "status": "bad_request", "error": "rows_required"}

    settings = _normalize_mmf_v3_settings(payload)
    cache_key = (
        "provided_rows_v2",
        payload.get("symbol"),
        payload.get("timeframe"),
        _rows_cache_signature(rows),
        _mmf_v3_settings_cache_signature(settings),
        bool(_safe_bool(payload.get("includeDebug"), False)),
        bool(_safe_bool(payload.get("includeSignalFrame"), True)),
    )
    cached_result = _get_mmf_v3_cached_result(cache_key)
    if cached_result is not None:
        return {
            "ok": True,
            "status": "ready",
            "jobId": None,
            "result": {
                **cached_result,
                "status": "ok",
                "symbol": payload.get("symbol"),
                "timeframe": payload.get("timeframe"),
                "mode": "provided_rows",
                "metadata": {
                    **(cached_result.get("metadata") if isinstance(cached_result.get("metadata"), dict) else {}),
                    "indicator": "MMF_V3",
                    "cacheHit": True,
                    "source": "async_cache",
                    "featureSettings": _mmf_v3_feature_settings_payload(settings),
                    "featureSettingsHash": _feature_settings_hash(settings),
                    "computeMode": "async_feature_signal_cache",
                },
            },
        }

    job_id = uuid4().hex
    _set_mmf_v3_job(job_id, {"ok": True, "status": "pending", "jobId": job_id, "createdAt": time()})

    def run_job() -> None:
        _set_mmf_v3_job(job_id, {"ok": True, "status": "running", "jobId": job_id, "createdAt": time()})
        try:
            result = _calculate_mmf_v3_indicator_from_rows_with_settings(payload, rows, settings)
            _set_mmf_v3_job(job_id, {"ok": True, "status": "ready", "jobId": job_id, "result": result, "updatedAt": time()})
        except Exception as exc:
            _set_mmf_v3_job(job_id, {"ok": False, "status": "failed", "jobId": job_id, "error": str(exc), "updatedAt": time()})

    Thread(target=run_job, daemon=True).start()
    return {"ok": True, "status": "pending", "jobId": job_id}
