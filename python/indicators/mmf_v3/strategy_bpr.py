from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from .features import finite_number
from .models import MmfV3Marker, MmfV3Settings, create_mmf_v3_marker
from .tsi_crosses import _find_confirm_index


@dataclass
class _OpenTrade:
    side: str
    entry_index: int
    stop_price: float | None


def create_bpr_m5_strategy_markers(features: pd.DataFrame, settings: MmfV3Settings) -> list[MmfV3Marker]:
    if not bool(getattr(settings, "show_bpr_m5_strategy", False)):
        return []
    if not _has_required_columns(features):
        return []

    long_confirm = _confirmed_tsi_crosses(features, "tsiCrossUpSignal", "tsiCrossDownSignal", 1, float(getattr(settings, "tsi_golden_cross_confirm_distance", 5.0)))
    short_confirm = _confirmed_tsi_crosses(features, "tsiCrossDownSignal", "tsiCrossUpSignal", -1, float(getattr(settings, "tsi_dead_cross_confirm_distance", 5.0)))
    long_entry_by_index = set(long_confirm.values())
    short_entry_by_index = set(short_confirm.values())

    markers: list[MmfV3Marker] = []
    long_setup = False
    short_setup = False
    long_pullback = False
    short_rebound = False
    open_trade: _OpenTrade | None = None

    for index in range(len(features)):
        if open_trade is not None:
            stop_marker = _resolve_stop_marker(features, index, open_trade)
            if stop_marker is not None:
                markers.append(stop_marker)
                open_trade = None
                long_setup = False
                short_setup = False
                long_pullback = False
                short_rebound = False
                continue

            if open_trade.side == "long" and index in short_entry_by_index:
                marker = _create_marker(features, index, "MMF_V3_BPR_LONG_EXIT", "high", "bpr_long_exit_tsi_dead_cross_confirm")
                if marker is not None:
                    markers.append(marker)
                open_trade = None
                continue

            if open_trade.side == "short" and index in long_entry_by_index:
                marker = _create_marker(features, index, "MMF_V3_BPR_SHORT_EXIT", "low", "bpr_short_exit_tsi_golden_cross_confirm")
                if marker is not None:
                    markers.append(marker)
                open_trade = None
                continue

        if bool(features["vdoEnterOverbought"].iloc[index]) and bool(features["vdoBullMarketActive"].iloc[index]):
            long_setup = True
            long_pullback = False
        if bool(features["vdoEnterOversold"].iloc[index]) and bool(features["vdoBearMarketActive"].iloc[index]):
            short_setup = True
            short_rebound = False

        vmi = pd.to_numeric(features["vmiHistogram"].iloc[index], errors="coerce")
        if long_setup and finite_number(vmi) and float(vmi) < 0:
            long_pullback = True
        if short_setup and finite_number(vmi) and float(vmi) > 0:
            short_rebound = True

        if open_trade is None and long_setup and long_pullback and index in long_entry_by_index:
            marker = _create_marker(features, index, "MMF_V3_BPR_LONG_ENTRY", "low", "bpr_long_entry_bull_overbought_pullback_tsi_golden_confirm")
            if marker is not None:
                markers.append(marker)
                open_trade = _OpenTrade("long", index, _stop_price(features, index, "long"))
            long_setup = False
            long_pullback = False
            short_setup = False
            short_rebound = False
            continue

        if open_trade is None and short_setup and short_rebound and index in short_entry_by_index:
            marker = _create_marker(features, index, "MMF_V3_BPR_SHORT_ENTRY", "high", "bpr_short_entry_bear_oversold_rebound_tsi_dead_confirm")
            if marker is not None:
                markers.append(marker)
                open_trade = _OpenTrade("short", index, _stop_price(features, index, "short"))
            long_setup = False
            long_pullback = False
            short_setup = False
            short_rebound = False

    return markers


def _has_required_columns(features: pd.DataFrame) -> bool:
    required = {
        "time",
        "high",
        "low",
        "vmiHistogram",
        "vdoBullMarketActive",
        "vdoBearMarketActive",
        "vdoEnterOverbought",
        "vdoEnterOversold",
        "tsiCrossDownSignal",
        "tsiCrossUpSignal",
        "tsiHistogram",
    }
    return required.issubset(features.columns)


def _confirmed_tsi_crosses(features: pd.DataFrame, cross_column: str, opposite_column: str, sign: int, confirm_distance: float) -> dict[int, int]:
    confirmed: dict[int, int] = {}
    for cross_index, value in enumerate(features[cross_column].to_numpy()):
        if not bool(value):
            continue
        confirm_index = _find_confirm_index(features, cross_index, opposite_column, sign, max(0.0, confirm_distance))
        if confirm_index is not None:
            confirmed[cross_index] = confirm_index
    return confirmed


def _resolve_stop_marker(features: pd.DataFrame, index: int, trade: _OpenTrade) -> MmfV3Marker | None:
    if trade.stop_price is None or index <= trade.entry_index:
        return None
    if trade.side == "long":
        low = pd.to_numeric(features["low"].iloc[index], errors="coerce")
        if finite_number(low) and float(low) <= trade.stop_price:
            return _create_marker(features, index, "MMF_V3_BPR_LONG_STOP_LOSS", "low", "bpr_long_stop_loss_morgan_2_8")
    else:
        high = pd.to_numeric(features["high"].iloc[index], errors="coerce")
        if finite_number(high) and float(high) >= trade.stop_price:
            return _create_marker(features, index, "MMF_V3_BPR_SHORT_STOP_LOSS", "high", "bpr_short_stop_loss_morgan_2_8")
    return None


def _stop_price(features: pd.DataFrame, index: int, side: str) -> float | None:
    column = "morgan_neg_0_236" if side == "long" else "morgan_0_236"
    if column not in features.columns:
        return None
    value = pd.to_numeric(features[column].iloc[index], errors="coerce")
    return float(value) if finite_number(value) else None


def _create_marker(features: pd.DataFrame, index: int, marker_type: str, price_column: str, reason: str) -> MmfV3Marker | None:
    price = pd.to_numeric(features[price_column].iloc[index], errors="coerce")
    if not finite_number(price):
        return None
    time = int(features["time"].iloc[index])
    bar_key = str(features["barKey"].iloc[index]) if "barKey" in features.columns else f"bar:{time}"
    marker_price = float(price)
    return create_mmf_v3_marker(
        type=marker_type,  # type: ignore[arg-type]
        event_index=index,
        event_bar_key=bar_key,
        event_time=time,
        confirm_index=index,
        confirm_bar_key=bar_key,
        confirm_time=time,
        marker_index=index,
        marker_bar_key=bar_key,
        marker_time=time,
        marker_price=marker_price,
        entry_index=index,
        entry_bar_key=bar_key,
        entry_time=time,
        entry_price=marker_price,
        point_distance=0.0,
        window_start_index=index,
        window_start_bar_key=bar_key,
        window_start_time=time,
        window_end_index=index,
        window_end_bar_key=bar_key,
        window_end_time=time,
        reason=(reason,),
    )
