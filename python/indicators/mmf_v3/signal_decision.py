from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd

from .marker_factory import create_marker
from .models import MmfV3Marker, MmfV3Settings
from .stoch_state_machine import StochStateSignal, calculate_stoch_state_signals
from .strategy_bpr import create_bpr_m5_strategy_markers
from .support_resistance import classify_vmi_zero_levels
from .trend_retrace import create_trend_retrace_markers
from .tsi_crosses import create_tsi_cross_markers
from .vdo_breaks import create_vdo_break_markers
from .vmi_divergence import apply_vmi_divergence_classifications


@dataclass(frozen=True)
class MmfV3DecisionResult:
    markers: list[MmfV3Marker]
    stoch_signals: list[StochStateSignal]
    classifications: dict[int, tuple[str, str]]
    decision_frame: list[dict[str, Any]]


def calculate_mmf_v3_signal_decisions(
    features: pd.DataFrame,
    settings: MmfV3Settings,
    *,
    include_decision_frame: bool = True,
) -> MmfV3DecisionResult:
    stoch_signals = calculate_stoch_state_signals(features, settings)
    classifications = classify_vmi_zero_levels(features, stoch_signals, settings)
    classifications = apply_vmi_divergence_classifications(features, stoch_signals, settings, classifications)

    markers = [create_marker(signal, settings, classifications.get(index)) for index, signal in enumerate(stoch_signals)]
    markers.extend(create_trend_retrace_markers(features, stoch_signals, settings, classifications))
    markers.extend(create_tsi_cross_markers(features, settings))
    markers.extend(create_vdo_break_markers(features, settings))
    markers.extend(create_bpr_m5_strategy_markers(features, settings))
    markers = sorted(markers, key=lambda marker: (marker.marker.index, marker.type))

    return MmfV3DecisionResult(
        markers=markers,
        stoch_signals=stoch_signals,
        classifications=classifications,
        decision_frame=_build_decision_frame(features, stoch_signals, classifications, markers) if include_decision_frame else [],
    )


def _build_decision_frame(
    features: pd.DataFrame,
    stoch_signals: list[StochStateSignal],
    classifications: dict[int, tuple[str, str]],
    markers: list[MmfV3Marker],
) -> list[dict[str, Any]]:
    stoch_by_anchor: dict[int, list[dict[str, Any]]] = {}
    for signal_index, signal in enumerate(stoch_signals):
        stoch_by_anchor.setdefault(signal.anchor.index, []).append({
            "signalIndex": signal_index,
            "side": signal.type,
            "anchorIndex": signal.anchor.index,
            "anchorPrice": _json_number(signal.anchor.price),
            "eventIndex": signal.cross.index,
            "confirmIndex": signal.confirm.index,
            "classification": classifications.get(signal_index, (None, None))[0],
            "classificationReason": classifications.get(signal_index, (None, None))[1],
        })

    markers_by_index: dict[int, list[dict[str, Any]]] = {}
    for marker in markers:
        markers_by_index.setdefault(marker.marker.index, []).append({
            "type": marker.type,
            "price": _json_number(marker.marker.price),
            "eventIndex": marker.event.index,
            "confirmIndex": marker.confirm.index,
            "reason": list(marker.reason),
        })

    rows: list[dict[str, Any]] = []
    for index in range(len(features)):
        row = features.iloc[index]
        rows.append({
            "index": index,
            "time": _json_number(row.get("time")),
            "barKey": str(row.get("barKey", f"bar:{index}")),
            "vdo": _json_number(row.get("vdo")),
            "vdoBaseMa": _json_number(row.get("vdoBaseMa")),
            "vdoBase2Ma": _json_number(row.get("vdoBase2Ma")),
            "vmi": _json_number(row.get("vmiHistogram")),
            "stochK": _json_number(row.get("stochK")),
            "stochD": _json_number(row.get("stochD")),
            "tsi": _json_number(row.get("tsi")),
            "tsiSignal": _json_number(row.get("tsiSignal")),
            "tsiHistogram": _json_number(row.get("tsiHistogram")),
            "tsiCrossDownSignal": bool(row.get("tsiCrossDownSignal", False)),
            "tsiCrossUpSignal": bool(row.get("tsiCrossUpSignal", False)),
            "vdoEnterOverbought": bool(row.get("vdoEnterOverbought", False)),
            "vdoExitOverbought": bool(row.get("vdoExitOverbought", False)),
            "vdoOverboughtActive": bool(row.get("vdoOverboughtActive", False)),
            "vdoOverboughtEpoch": _json_number(row.get("vdoOverboughtEpoch")),
            "vdoEnterOversold": bool(row.get("vdoEnterOversold", False)),
            "vdoExitOversold": bool(row.get("vdoExitOversold", False)),
            "vdoOversoldActive": bool(row.get("vdoOversoldActive", False)),
            "vdoOversoldEpoch": _json_number(row.get("vdoOversoldEpoch")),
            "vdoCrossUpUpper": bool(row.get("vdoCrossUpUpper", False)),
            "vdoCrossDownUpper": bool(row.get("vdoCrossDownUpper", False)),
            "vdoCrossDownLower": bool(row.get("vdoCrossDownLower", False)),
            "vdoCrossUpLower": bool(row.get("vdoCrossUpLower", False)),
            "vdoCrossUpBaseMa": bool(row.get("vdoCrossUpBaseMa", False)),
            "vdoCrossDownBaseMa": bool(row.get("vdoCrossDownBaseMa", False)),
            "vdoBullMarketActive": bool(row.get("vdoBullMarketActive", False)),
            "vdoBearMarketActive": bool(row.get("vdoBearMarketActive", False)),
            "stochSignals": stoch_by_anchor.get(index, []),
            "markers": markers_by_index.get(index, []),
            "markerTypes": [entry["type"] for entry in markers_by_index.get(index, [])],
        })
    return rows


def _json_number(value: Any) -> float | int | None:
    number = pd.to_numeric(value, errors="coerce")
    if pd.isna(number):
        return None
    out = float(number)
    return int(out) if out.is_integer() else out
