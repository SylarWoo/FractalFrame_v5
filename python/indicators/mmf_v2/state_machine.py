from __future__ import annotations

import pandas as pd

from .expected_levels import create_expected_level_markers
from .marker_factory import create_marker
from .models import MmfV2Marker, MmfV2Settings
from .stoch_state_machine import calculate_stoch_state_signals
from .support_resistance import classify_vdo_levels
from .trend_divergence import create_trend_divergence_markers
from .trend_retrace import create_trend_retrace_markers
from .trend_return import create_trend_return_markers
from .vdo_breaks import create_vdo_break_markers


def calculate_mmf_v2_state_machine_markers(features: pd.DataFrame, settings: MmfV2Settings) -> list[MmfV2Marker]:
    signals = calculate_stoch_state_signals(features, settings)
    classifications = classify_vdo_levels(features, signals, settings)
    markers = [create_marker(signal, settings, classifications.get(index)) for index, signal in enumerate(signals)]
    markers.extend(create_expected_level_markers(features, signals, settings))
    markers.extend(create_trend_retrace_markers(features, signals, settings))
    markers.extend(create_trend_return_markers(features, signals, settings))
    markers.extend(create_trend_divergence_markers(features, signals, settings))
    markers.extend(create_vdo_break_markers(features, settings))
    return sorted(markers, key=lambda marker: (marker.marker.index, marker.type))
