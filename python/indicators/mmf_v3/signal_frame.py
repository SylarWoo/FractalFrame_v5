from __future__ import annotations

from typing import Any

import pandas as pd

from .models import MmfV3Marker
from .signal_catalog import get_mmf_v3_signal_catalog

POINT_MOMENTUM_TYPES = {
    "MMF_V3_HIGH": "down",
    "MMF_V3_RESISTANCE": "down",
    "MMF_V3_LOW": "up",
    "MMF_V3_SUPPORT": "up",
}

BREAKOUT_MOMENTUM_TYPES = {
    "MMF_V3_RESISTANCE_UP_BREAK": ("up", {"MMF_V3_LOW", "MMF_V3_SUPPORT"}),
    "MMF_V3_SUPPORT_DOWN_BREAK": ("down", {"MMF_V3_HIGH", "MMF_V3_RESISTANCE"}),
}

CLOSE_MOMENTUM_TYPES = {
    "MMF_V3_SUPPORT_UP_BREAK": ("up", {"MMF_V3_LOW", "MMF_V3_SUPPORT"}),
    "MMF_V3_RESISTANCE_DOWN_BREAK": ("down", {"MMF_V3_HIGH", "MMF_V3_RESISTANCE"}),
}


def build_mmf_v3_signal_frame(
    features: pd.DataFrame,
    markers: list[MmfV3Marker],
    *,
    period_seconds: int | None = None,
) -> list[dict[str, Any]]:
    signal_types = [str(entry["catalogId"]) for entry in get_mmf_v3_signal_catalog()]
    rows = [_base_signal_frame_row(features, index, signal_types) for index in range(len(features))]
    sorted_markers = sorted(markers, key=lambda marker: (marker.marker.index, marker.type))

    for marker in sorted_markers:
        marker_index = int(marker.marker.index)
        if marker_index < 0 or marker_index >= len(rows):
            continue
        signal_payload = _signal_payload(marker)
        _attach_momentum(signal_payload, marker, sorted_markers, features, period_seconds)
        row = rows[marker_index]
        row["signals"].append(signal_payload)
        row["signalIds"].append(signal_payload["signalId"])
        row["signalTypes"].append(signal_payload["type"])
        row["signalFlags"][signal_payload["type"]] = True
        row["signalCount"] = len(row["signals"])

    return rows


def build_mmf_v3_signal_payloads(
    features: pd.DataFrame,
    markers: list[MmfV3Marker],
    *,
    period_seconds: int | None = None,
) -> list[dict[str, Any]]:
    sorted_markers = sorted(markers, key=lambda marker: (marker.marker.index, marker.type))
    payloads: list[dict[str, Any]] = []
    for marker in sorted_markers:
        marker_index = int(marker.marker.index)
        if marker_index < 0 or marker_index >= len(features):
            continue
        signal_payload = _signal_payload(marker)
        _attach_momentum(signal_payload, marker, sorted_markers, features, period_seconds)
        payloads.append(signal_payload)
    return payloads


def _base_signal_frame_row(features: pd.DataFrame, index: int, signal_types: list[str]) -> dict[str, Any]:
    row = features.iloc[index]
    close = _json_number(row.get("close"))
    morgan_center = _json_number(row.get("morgan_center"))
    morgan_true_range = _json_number(row.get("morgan_true_range"))
    vwap = _json_number(row.get("vwap"))
    vwap_upper = _json_number(row.get("vwapUpperBand"))
    vwap_lower = _json_number(row.get("vwapLowerBand"))
    return {
        "index": index,
        "barKey": str(row.get("barKey", f"bar:{_json_number(row.get('time')) or index}")),
        "sourceIndex": _json_number(row.get("sourceIndex")),
        "time": _json_number(row.get("time")),
        "open": _json_number(row.get("open")),
        "high": _json_number(row.get("high")),
        "low": _json_number(row.get("low")),
        "close": close,
        "stoch": {
            "k": _json_number(row.get("stochK")),
            "d": _json_number(row.get("stochD")),
        },
        "vdo": {
            "value": _json_number(row.get("vdo")),
            "baseMa": _json_number(row.get("vdoBaseMa")),
            "base2Ma": _json_number(row.get("vdoBase2Ma")),
            "delta": _json_number(row.get("vdoDelta")),
            "direction": _json_number(row.get("vdoDirection")),
            "zoneCode": _json_number(row.get("vdoZoneCode")),
            "crossUpZero": bool(row.get("vdoCrossUpZero", False)),
            "crossDownZero": bool(row.get("vdoCrossDownZero", False)),
            "crossUpUpper2": bool(row.get("vdoCrossUpUpper2", False)),
            "crossDownUpper2": bool(row.get("vdoCrossDownUpper2", False)),
            "crossUpUpper": bool(row.get("vdoCrossUpUpper", False)),
            "crossDownUpper": bool(row.get("vdoCrossDownUpper", False)),
            "crossUpUpper3": bool(row.get("vdoCrossUpUpper3", False)),
            "crossDownUpper3": bool(row.get("vdoCrossDownUpper3", False)),
            "crossDownLower2": bool(row.get("vdoCrossDownLower2", False)),
            "crossUpLower2": bool(row.get("vdoCrossUpLower2", False)),
            "crossDownLower": bool(row.get("vdoCrossDownLower", False)),
            "crossUpLower": bool(row.get("vdoCrossUpLower", False)),
            "crossDownLower3": bool(row.get("vdoCrossDownLower3", False)),
            "crossUpLower3": bool(row.get("vdoCrossUpLower3", False)),
        },
        "vmi": {
            "histogram": _json_number(row.get("vmiHistogram")),
            "fastMa": _json_number(row.get("vmiFastMa")),
            "slowMa": _json_number(row.get("vmiSlowMa")),
            "delta": _json_number(row.get("vmiDelta")),
            "direction": _json_number(row.get("vmiDirection")),
            "crossUpZero": bool(row.get("vmiCrossUpZero", False)),
            "crossDownZero": bool(row.get("vmiCrossDownZero", False)),
        },
        "ma": {
            "value": _json_number(row.get("ma")),
            "type": str(row.get("maType", "sma")),
            "length": int(row.get("maLength", 120)),
            "source": str(row.get("maSource", "hlc3")),
        },
        "vwap": {
            "value": vwap,
            "upperBand": vwap_upper,
            "lowerBand": vwap_lower,
            "bandWidth": _vwap_band_width(vwap_upper, vwap_lower),
            "positionRatio": _vwap_position_ratio(close, vwap_upper, vwap_lower),
            "source": str(row.get("vwapSource", "hlc3")),
            "anchorPeriod": str(row.get("vwapAnchorPeriod", "session")),
            "bandCalculationMode": str(row.get("vwapBandCalculationMode", "standard_deviation")),
            "band1Multiplier": _json_number(row.get("vwapBand1Multiplier")),
        },
        "morgan": {
            "center": morgan_center,
            "trueRange": morgan_true_range,
            "positionRatio": _morgan_position_ratio(close, morgan_center, morgan_true_range),
            "segmentIndex": _json_number(row.get("morganSegmentIndex")),
            "levels": {
                "-0.236": _json_number(row.get("morgan_neg_0_236")),
                "-0.118": _json_number(row.get("morgan_neg_0_118")),
                "0.118": _json_number(row.get("morgan_0_118")),
                "0.236": _json_number(row.get("morgan_0_236")),
            },
        },
        "signals": [],
        "signalIds": [],
        "signalTypes": [],
        "signalFlags": {signal_type: False for signal_type in signal_types},
        "signalCount": 0,
    }


def _signal_payload(marker: MmfV3Marker) -> dict[str, Any]:
    return {
        "signalId": marker.signal_id,
        "type": marker.type,
        "catalogId": marker.catalog.get("catalogId", marker.type),
        "label": marker.catalog.get("label"),
        "category": marker.catalog.get("category"),
        "direction": marker.catalog.get("direction"),
        "role": marker.catalog.get("role"),
        "timing": marker.catalog.get("timing"),
        "layer": marker.catalog.get("layer"),
        "strategyIntent": marker.catalog.get("strategyIntent"),
        "markerIndex": marker.marker.index,
        "markerBarKey": marker.marker.bar_key,
        "markerTime": marker.marker.time,
        "markerPrice": marker.marker.price,
        "entryIndex": marker.entry.index,
        "entryBarKey": marker.entry.bar_key,
        "entryTime": marker.entry.time,
        "entryPrice": marker.entry.price,
        "eventIndex": marker.event.index,
        "confirmIndex": marker.confirm.index,
        "pointDistance": marker.metrics.get("pointDistance"),
        "metrics": dict(marker.metrics),
        "reason": list(marker.reason),
    }


def _attach_momentum(
    payload: dict[str, Any],
    marker: MmfV3Marker,
    sorted_markers: list[MmfV3Marker],
    features: pd.DataFrame,
    period_seconds: int | None,
) -> None:
    marker_type = marker.type
    if marker_type in POINT_MOMENTUM_TYPES:
        momentum = _calculate_vdo_momentum(features, marker.marker.index, marker.entry.index, period_seconds)
        _set_momentum(payload, "high_low", POINT_MOMENTUM_TYPES[marker_type], marker.marker.index, marker.entry.index, momentum)
        return

    if marker_type in BREAKOUT_MOMENTUM_TYPES:
        direction, previous_types = BREAKOUT_MOMENTUM_TYPES[marker_type]
        previous = _find_previous_marker(sorted_markers, marker.marker.index, previous_types)
        if previous is not None:
            momentum = _calculate_vdo_momentum(features, previous.marker.index, marker.marker.index, period_seconds)
            _set_momentum(payload, "breakout", direction, previous.marker.index, marker.marker.index, momentum, previous)
        return

    if marker_type in CLOSE_MOMENTUM_TYPES:
        direction, previous_types = CLOSE_MOMENTUM_TYPES[marker_type]
        previous = _find_previous_marker(sorted_markers, marker.marker.index, previous_types)
        if previous is not None:
            momentum = _calculate_vdo_momentum(features, previous.marker.index, marker.marker.index, period_seconds)
            _set_momentum(payload, "close", direction, previous.marker.index, marker.marker.index, momentum, previous)


def _set_momentum(
    payload: dict[str, Any],
    kind: str,
    direction: str,
    start_index: int,
    end_index: int,
    momentum: float | None,
    previous_marker: MmfV3Marker | None = None,
) -> None:
    bars = end_index - start_index
    payload["momentum"] = {
        "kind": kind,
        "direction": direction,
        "value": momentum,
        "bars": bars if bars > 0 else None,
        "startIndex": start_index,
        "endIndex": end_index,
        "previousSignalId": previous_marker.signal_id if previous_marker is not None else None,
        "previousType": previous_marker.type if previous_marker is not None else None,
    }
    payload["metrics"][f"vdo{_pascal_case(kind)}Momentum"] = momentum


def _find_previous_marker(sorted_markers: list[MmfV3Marker], marker_index: int, previous_types: set[str]) -> MmfV3Marker | None:
    for candidate in reversed(sorted_markers):
        if candidate.marker.index < marker_index and candidate.type in previous_types:
            return candidate
    return None


def _calculate_vdo_momentum(features: pd.DataFrame, start_index: int, end_index: int, period_seconds: int | None) -> float | None:
    if start_index < 0 or end_index < 0 or start_index >= len(features) or end_index >= len(features):
        return None
    bars = end_index - start_index
    if bars <= 0:
        return None
    seconds = bars * _resolve_period_seconds(features, start_index, end_index, period_seconds)
    if seconds <= 0:
        return None
    start_vdo = _json_number(features.iloc[start_index].get("vdo"))
    end_vdo = _json_number(features.iloc[end_index].get("vdo"))
    if start_vdo is None or end_vdo is None:
        return None
    momentum = abs(end_vdo - start_vdo) * 1_000_000 / seconds
    return momentum if pd.notna(momentum) else None


def _resolve_period_seconds(features: pd.DataFrame, start_index: int, end_index: int, period_seconds: int | None) -> int:
    if period_seconds is not None and period_seconds > 0:
        return int(period_seconds)
    start_time = _json_number(features.iloc[start_index].get("time"))
    end_time = _json_number(features.iloc[end_index].get("time"))
    bars = end_index - start_index
    if start_time is not None and end_time is not None and bars > 0:
        inferred = int(round((end_time - start_time) / bars))
        if inferred > 0:
            return inferred
    return 60


def _morgan_position_ratio(close: float | None, center: float | None, true_range: float | None) -> float | None:
    if close is None or center is None or true_range is None or true_range == 0:
        return None
    return (close - center) / true_range


def _vwap_band_width(upper: float | None, lower: float | None) -> float | None:
    if upper is None or lower is None:
        return None
    return upper - lower


def _vwap_position_ratio(close: float | None, upper: float | None, lower: float | None) -> float | None:
    width = _vwap_band_width(upper, lower)
    if close is None or lower is None or width is None or width == 0:
        return None
    return (close - lower) / width


def _json_number(value: Any) -> float | int | None:
    number = pd.to_numeric(value, errors="coerce")
    if pd.isna(number):
        return None
    out = float(number)
    return int(out) if out.is_integer() else out


def _pascal_case(value: str) -> str:
    return "".join(part.capitalize() for part in value.split("_"))
