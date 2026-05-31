import pandas as pd

from .models import MmfV2Marker, MmfV2Settings
from .signal_decision import calculate_mmf_v2_signal_decisions


def calculate_mmf_v2_state_machine_markers(features: pd.DataFrame, settings: MmfV2Settings) -> list[MmfV2Marker]:
    return calculate_mmf_v2_signal_decisions(features, settings).markers
