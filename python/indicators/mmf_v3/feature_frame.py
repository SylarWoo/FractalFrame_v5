from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd

from python.indicators.ma import calculate_ma_frame
from python.indicators.mmf_v3.features import apply_mmf_v3_vdo_threshold_states, calculate_morgan_feature
from python.indicators.stoch import calculate_stoch_frame
from python.indicators.tsi import calculate_tsi_frame
from python.indicators.vdo import calculate_vdo_frame
from python.indicators.vmi import calculate_vmi_frame
from python.indicators.vwap import calculate_vwap_frame


@dataclass(frozen=True)
class MmfV3FeatureFrame:
    frame: pd.DataFrame
    settings: Any


def build_mmf_v3_feature_frame(frame: pd.DataFrame, settings: Any) -> MmfV3FeatureFrame:
    metadata_columns = [name for name in ["barKey", "sourceIndex", "calcIndex", "time", "open", "high", "low", "close", "volume"] if name in frame.columns]
    features = frame[metadata_columns].copy()
    stoch_features = calculate_stoch_frame(frame, settings.stoch)
    vdo_features = calculate_vdo_frame(frame, settings.vdo)
    apply_mmf_v3_vdo_threshold_states(vdo_features)
    ma_features = calculate_ma_frame(frame, settings.ma)
    vmi_features = calculate_vmi_frame(frame, {
        "fast_length": getattr(settings.vmi, "fast_length", 5),
        "slow_length": getattr(settings.vmi, "slow_length", 34),
        "vdo": getattr(settings, "vdo", None),
        "vdo_values": vdo_features["vdo"],
    })
    tsi_features = calculate_tsi_frame(frame, getattr(settings, "tsi", None))
    vwap_features = calculate_vwap_frame(frame, getattr(settings, "vwap", None))
    morgan_features = calculate_morgan_feature(frame, settings.morgan)
    return MmfV3FeatureFrame(
        frame=pd.concat([features, stoch_features, vdo_features, vmi_features, tsi_features, ma_features, vwap_features, morgan_features], axis=1),
        settings=settings,
    )


def build_mmf_v3_features(frame: pd.DataFrame, settings: Any) -> pd.DataFrame:
    return build_mmf_v3_feature_frame(frame, settings).frame
