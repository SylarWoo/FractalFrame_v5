from __future__ import annotations

import pandas as pd

from .features import finite_number
from .models import MmfV3Marker, MmfV3Settings, create_mmf_v3_marker


def create_vdo_break_markers(features: pd.DataFrame, settings: MmfV3Settings) -> list[MmfV3Marker]:
    markers = create_vdo_market_markers(features, settings)
    markers.extend(create_vdo_threshold_markers(features, settings))
    return markers


def create_vdo_threshold_markers(features: pd.DataFrame, settings: MmfV3Settings) -> list[MmfV3Marker]:
    specs: list[tuple[bool, str, str, str, str]] = [
        (
            bool(getattr(settings, "show_overbought_point", False)),
            "up_upper",
            "MMF_V3_OVERBOUGHT",
            "low",
            "vdo_cross_up_upper_overbought_open",
        ),
        (
            bool(getattr(settings, "show_overbought_close_point", False)),
            "down_upper",
            "MMF_V3_OVERBOUGHT_CLOSE",
            "high",
            "vdo_cross_down_upper_overbought_close",
        ),
        (
            bool(getattr(settings, "show_oversold_point", False)),
            "down_lower",
            "MMF_V3_OVERSOLD",
            "high",
            "vdo_cross_down_lower_oversold_open",
        ),
        (
            bool(getattr(settings, "show_oversold_close_point", False)),
            "up_lower",
            "MMF_V3_OVERSOLD_CLOSE",
            "low",
            "vdo_cross_up_lower_oversold_close",
        ),
    ]
    markers: list[MmfV3Marker] = []
    for enabled, cross_type, marker_type, price_column, reason in specs:
        if not enabled:
            continue
        markers.extend(_create_vdo_break_markers(
            features,
            _vdo_threshold_cross_indexes(features, cross_type),
            marker_type,
            price_column,
            reason,
        ))
    return markers


def _vdo_threshold_cross_indexes(features: pd.DataFrame, cross_type: str) -> list[int]:
    state_column_by_cross_type = {
        "up_upper": "vdoEnterOverbought",
        "down_upper": "vdoExitOverbought",
        "down_lower": "vdoEnterOversold",
        "up_lower": "vdoExitOversold",
    }
    state_column = state_column_by_cross_type.get(cross_type)
    if state_column in features.columns:
        values = features[state_column].to_numpy()
        return [index for index, value in enumerate(values) if bool(value)]

    if "vdo" not in features.columns:
        return []
    threshold_column = "vdoUpLineValue" if cross_type.endswith("_upper") else "vdoDownLineValue"
    threshold2_column = "vdoUpLine2Value" if cross_type.endswith("_upper") else "vdoDownLine2Value"
    if threshold_column not in features.columns:
        return []

    vdo = pd.to_numeric(features["vdo"], errors="coerce")
    previous_vdo = vdo.shift(1)
    threshold = _outer_vdo_threshold_series(features, threshold_column, threshold2_column, cross_type)
    previous_threshold = threshold.shift(1)
    if cross_type.startswith("up_"):
        mask = (previous_vdo < previous_threshold) & (vdo >= threshold)
    else:
        mask = (previous_vdo > previous_threshold) & (vdo <= threshold)
    return [index for index, value in enumerate(mask.fillna(False).to_numpy()) if bool(value)]


def _outer_vdo_threshold_series(features: pd.DataFrame, threshold_column: str, threshold2_column: str, cross_type: str) -> pd.Series:
    primary = pd.to_numeric(features[threshold_column], errors="coerce")
    if threshold2_column not in features.columns:
        return primary
    secondary = pd.to_numeric(features[threshold2_column], errors="coerce")
    values = pd.concat([primary, secondary], axis=1)
    return values.max(axis=1) if cross_type.endswith("_upper") else values.min(axis=1)


def create_vdo_market_markers(features: pd.DataFrame, settings: MmfV3Settings) -> list[MmfV3Marker]:
    specs: list[tuple[bool, str, str, str, str]] = [
        (
            bool(getattr(settings, "show_bull_market_point", False)),
            "vdoCrossUpBaseMa",
            "MMF_V3_BULL_MARKET",
            "low",
            "vdo_cross_up_base_ma",
        ),
        (
            bool(getattr(settings, "show_bear_market_point", False)),
            "vdoCrossDownBaseMa",
            "MMF_V3_BEAR_MARKET",
            "high",
            "vdo_cross_down_base_ma",
        ),
    ]
    markers: list[MmfV3Marker] = []
    for enabled, column, marker_type, price_column, reason in specs:
        if not enabled:
            continue
        markers.extend(_create_vdo_break_markers(
            features,
            _vdo_market_cross_indexes(features, column, marker_type),
            marker_type,
            price_column,
            reason,
        ))
    return markers


def _vdo_market_cross_indexes(features: pd.DataFrame, column: str, marker_type: str) -> list[int]:
    if column in features.columns:
        return [index for index, value in enumerate(features[column].to_numpy()) if bool(value)]
    if "vdo" not in features.columns or "vdoBaseMa" not in features.columns:
        return []
    indexes: list[int] = []
    for index in range(1, len(features)):
        previous_vdo = features["vdo"].iloc[index - 1]
        previous_ma = features["vdoBaseMa"].iloc[index - 1]
        current_vdo = features["vdo"].iloc[index]
        current_ma = features["vdoBaseMa"].iloc[index]
        if not (finite_number(previous_vdo) and finite_number(previous_ma) and finite_number(current_vdo) and finite_number(current_ma)):
            continue
        if marker_type == "MMF_V3_BULL_MARKET" and float(previous_vdo) < float(previous_ma) <= float(current_vdo):
            indexes.append(index)
        if marker_type == "MMF_V3_BEAR_MARKET" and float(previous_vdo) > float(previous_ma) >= float(current_vdo):
            indexes.append(index)
    return indexes


def _create_vdo_break_markers(
    features: pd.DataFrame,
    indexes: list[int],
    marker_type: str,
    price_column: str,
    reason: str,
) -> list[MmfV3Marker]:
    if not indexes or price_column not in features.columns or "time" not in features.columns:
        return []
    times = features["time"].to_numpy()
    prices = features[price_column].to_numpy()
    bar_keys = features["barKey"].to_numpy() if "barKey" in features.columns else None
    markers: list[MmfV3Marker] = []
    for index in indexes:
        if index < 0 or index >= len(features):
            continue
        price_value = prices[index]
        if not finite_number(price_value):
            continue
        time = int(times[index])
        bar_key = str(bar_keys[index]) if bar_keys is not None else f"bar:{time}"
        price = float(price_value)
        markers.append(create_mmf_v3_marker(
            type=marker_type,
            event_index=index,
            event_bar_key=bar_key,
            event_time=time,
            confirm_index=index,
            confirm_bar_key=bar_key,
            confirm_time=time,
            marker_index=index,
            marker_bar_key=bar_key,
            marker_time=time,
            marker_price=price,
            entry_index=index,
            entry_bar_key=bar_key,
            entry_time=time,
            entry_price=price,
            point_distance=0.0,
            window_start_index=index,
            window_start_bar_key=bar_key,
            window_start_time=time,
            window_end_index=index,
            window_end_bar_key=bar_key,
            window_end_time=time,
            reason=(reason,),
        ))
    return markers
