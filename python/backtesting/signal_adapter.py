from __future__ import annotations

from typing import Any

import pandas as pd

from python.indicators.mmf_v2.models import MmfV2Marker
from python.indicators.mmf_v3.models import MmfV3Marker


def build_signal_table_from_mmf_v2(features: pd.DataFrame, markers: list[MmfV2Marker], *, source: str = "MMF_V2") -> list[dict[str, Any]]:
    return _build_signal_table_from_markers(features, markers, source=source)


def build_signal_table_from_mmf_v3(features: pd.DataFrame, markers: list[MmfV3Marker], *, source: str = "MMF_V3") -> list[dict[str, Any]]:
    return _build_signal_table_from_markers(features, markers, source=source)


def _build_signal_table_from_markers(features: pd.DataFrame, markers: list[Any], *, source: str) -> list[dict[str, Any]]:
    source_index_by_bar_key = _lookup_by_bar_key(features, "sourceIndex")
    time_by_bar_key = _lookup_by_bar_key(features, "time")
    rows: list[dict[str, Any]] = []

    for marker in sorted(markers, key=lambda item: (item.entry.index, item.type, item.signal_id)):
        entry_bar_key = marker.entry.bar_key
        source_index = _int_or_default(source_index_by_bar_key.get(entry_bar_key), marker.entry.index)
        entry_time = _int_or_default(time_by_bar_key.get(entry_bar_key), marker.entry.time)
        rows.append({
            "signalId": marker.signal_id,
            "signalType": marker.type,
            "indicator": marker.indicator,
            "side": marker.catalog.get("side"),
            "direction": marker.catalog.get("direction"),
            "role": marker.catalog.get("role"),
            "barKey": entry_bar_key,
            "sourceIndex": source_index,
            "time": entry_time,
            "price": _number_or_none(marker.entry.price),
            "confirmed": marker.confirm.index <= marker.entry.index,
            "confirmBarKey": marker.confirm.bar_key,
            "confirmIndex": marker.confirm.index,
            "confirmTime": marker.confirm.time,
            "confirmPrice": _number_or_none(marker.confirm.price),
            "source": source,
            "reason": list(marker.reason),
            "metrics": dict(marker.metrics),
        })

    return rows


def _lookup_by_bar_key(frame: pd.DataFrame, column: str) -> dict[str, Any]:
    if "barKey" not in frame.columns or column not in frame.columns:
        return {}
    return {str(row["barKey"]): row[column] for _, row in frame[["barKey", column]].iterrows()}


def _int_or_default(value: Any, default: int) -> int:
    number = pd.to_numeric(value, errors="coerce")
    if pd.isna(number):
        return int(default)
    return int(number)


def _number_or_none(value: Any) -> float | int | None:
    number = pd.to_numeric(value, errors="coerce")
    if pd.isna(number):
        return None
    out = float(number)
    return int(out) if out.is_integer() else out
