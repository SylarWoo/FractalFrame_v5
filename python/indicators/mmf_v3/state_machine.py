import pandas as pd

from .models import MmfV3Marker, MmfV3Settings
from .signal_decision import calculate_mmf_v3_signal_decisions


def calculate_mmf_v3_state_machine_markers(features: pd.DataFrame, settings: MmfV3Settings) -> list[MmfV3Marker]:
    return calculate_mmf_v3_signal_decisions(features, settings).markers
