from __future__ import annotations

from typing import Any

import pandas as pd

from .debug import create_debug_rows
from .feature_frame import build_mmf_v3_feature_frame
from .features import normalize_ohlcv_frame
from .models import MmfV3Settings
from .signal_decision import calculate_mmf_v3_signal_decisions
from .signal_catalog import get_mmf_v3_signal_catalog
from .signal_frame import build_mmf_v3_signal_frame
from .support_resistance import create_vmi_zero_level_debug
from python.market_data import create_bar_alignment_debug
from python.signals import signals_to_records

MMF_V3_ENGINE_VERSION = "mmf_v3_vmi_zero_support_resistance_v1"


def calculate_mmf_v3_markers(
    rows: list[dict[str, Any]] | pd.DataFrame,
    settings: MmfV3Settings | None = None,
    include_debug: bool = False,
    include_signal_frame: bool = True,
) -> dict[str, Any]:
    active_settings = settings or MmfV3Settings()
    frame = normalize_ohlcv_frame(rows)
    alignment_debug = create_bar_alignment_debug(rows, frame)
    if frame.empty:
        return {
            "ok": True,
            "version": "MMF_V3",
            "engine": MMF_V3_ENGINE_VERSION,
            "rowsCount": 0,
            "markersCount": 0,
            "markers": [],
            "momentumSamples": [],
            "momentumSamplesCount": 0,
            "momentumSummary": {},
            "signals": [],
            "signalFrame": [],
            "signalCatalog": get_mmf_v3_signal_catalog(),
            "debug": {"alignment": alignment_debug, "rows": []} if include_debug else None,
        }

    feature_frame = build_mmf_v3_feature_frame(frame, active_settings)
    return calculate_mmf_v3_markers_from_features(
        feature_frame.frame,
        active_settings,
        alignment_debug=alignment_debug,
        include_debug=include_debug,
        include_signal_frame=include_signal_frame,
    )


def calculate_mmf_v3_markers_from_features(
    features: pd.DataFrame,
    settings: MmfV3Settings | None = None,
    *,
    alignment_debug: dict[str, Any] | None = None,
    include_debug: bool = False,
    include_signal_frame: bool = True,
) -> dict[str, Any]:
    active_settings = settings or MmfV3Settings()
    decision_result = calculate_mmf_v3_signal_decisions(features, active_settings, include_decision_frame=include_debug)
    markers = decision_result.markers
    debug_signals = decision_result.stoch_signals if include_debug else []
    signal_ids = [marker.signal_id for marker in markers]
    signal_records = signals_to_records(markers)
    if include_signal_frame:
        signal_frame = build_mmf_v3_signal_frame(features, markers)
    else:
        signal_frame = []
    momentum_payload = {"momentumSamples": [], "momentumSamplesCount": 0, "momentumSummary": {}}

    return {
        "ok": True,
        "version": "MMF_V3",
        "engine": MMF_V3_ENGINE_VERSION,
        "rowsCount": int(len(features)),
        "markersCount": len(markers),
        "markers": [marker.to_payload() for marker in markers],
        **momentum_payload,
        "signals": signal_records,
        "signalsCount": len(signal_records),
        "signalFrame": signal_frame,
        "signalFrameCount": int(len(features)),
        "signalCatalog": get_mmf_v3_signal_catalog(),
        "debug": {
            "alignment": alignment_debug or {},
            "signals": {
                "records": len(markers),
                "signalIds": signal_ids[:100],
                "signalIdsUnique": len(signal_ids) == len(set(signal_ids)),
            },
            "rows": create_debug_rows(features),
            "decisionFrame": decision_result.decision_frame,
            "vmiZeroLevels": create_vmi_zero_level_debug(features, debug_signals),
        } if include_debug else None,
    }
