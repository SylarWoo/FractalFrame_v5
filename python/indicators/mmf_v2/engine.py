from __future__ import annotations

from typing import Any

import pandas as pd

from .debug import create_debug_rows
from .features import build_mmf_v2_features, normalize_ohlcv_frame
from .models import MmfV2Settings
from .signal_catalog import get_mmf_v2_signal_catalog
from .state_machine import calculate_mmf_v2_state_machine_markers
from python.market_data import create_bar_alignment_debug
from python.signals import signals_to_records

MMF_V2_ENGINE_VERSION = "mmf_v2_support_resistance_v1"


def calculate_mmf_v2_markers(
    rows: list[dict[str, Any]] | pd.DataFrame,
    settings: MmfV2Settings | None = None,
    include_debug: bool = False,
) -> dict[str, Any]:
    active_settings = settings or MmfV2Settings()
    frame = normalize_ohlcv_frame(rows)
    alignment_debug = create_bar_alignment_debug(rows, frame)
    if frame.empty:
        return {
            "ok": True,
            "version": "MMF_V2",
            "engine": MMF_V2_ENGINE_VERSION,
            "rowsCount": 0,
            "markersCount": 0,
            "markers": [],
            "signals": [],
            "signalCatalog": get_mmf_v2_signal_catalog(),
            "debug": {"alignment": alignment_debug, "rows": []} if include_debug else None,
        }

    features = build_mmf_v2_features(frame, active_settings)
    markers = calculate_mmf_v2_state_machine_markers(features, active_settings)
    signal_ids = [marker.signal_id for marker in markers]
    signal_records = signals_to_records(markers)

    return {
        "ok": True,
        "version": "MMF_V2",
        "engine": MMF_V2_ENGINE_VERSION,
        "rowsCount": int(len(frame)),
        "markersCount": len(markers),
        "markers": [marker.to_payload() for marker in markers],
        "signals": signal_records,
        "signalsCount": len(signal_records),
        "signalCatalog": get_mmf_v2_signal_catalog(),
        "debug": {
            "alignment": alignment_debug,
            "signals": {
                "records": len(markers),
                "signalIds": signal_ids[:100],
                "signalIdsUnique": len(signal_ids) == len(set(signal_ids)),
            },
            "rows": create_debug_rows(features),
        } if include_debug else None,
    }
