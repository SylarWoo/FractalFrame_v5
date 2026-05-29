from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import pandas as pd

from .crosses import dead_cross_value, golden_cross_value
from .features import finite_number
from .price_anchor import highest_high_index, lowest_low_index

StochCrossDirection = Literal["dead", "golden"]
PriceAnchorType = Literal["high", "low"]


@dataclass(frozen=True)
class StochCrossEvent:
    direction: StochCrossDirection
    index: int
    bar_key: str
    time: int
    value: float
    k: float
    d: float
    previous_index: int
    previous_k: float
    previous_d: float


@dataclass(frozen=True)
class StochConfirmEvent:
    cross: StochCrossEvent
    index: int
    bar_key: str
    time: int
    k: float
    advance: float
    bars_used: int
    max_bars: int


@dataclass(frozen=True)
class PriceAnchor:
    type: PriceAnchorType
    index: int
    bar_key: str
    time: int
    price: float
    window_start_index: int
    window_start_bar_key: str
    window_start_time: int
    window_end_index: int
    window_end_bar_key: str
    window_end_time: int


@dataclass(frozen=True)
class StochStateSignal:
    type: Literal["high", "low"]
    cross: StochCrossEvent
    confirm: StochConfirmEvent
    anchor: PriceAnchor
    entry_index: int
    entry_bar_key: str
    entry_time: int
    entry_price: float
    point_distance: float


def calculate_stoch_state_signals(features: pd.DataFrame, settings: object) -> list[StochStateSignal]:
    signals: list[StochStateSignal] = []
    rows_count = len(features)
    if rows_count <= 1:
        return signals

    times = features["time"].to_numpy()
    bar_keys = features["barKey"].to_numpy() if "barKey" in features.columns else features["time"].map(lambda value: f"bar:{int(value)}").to_numpy()
    highs = features["high"].to_numpy()
    lows = features["low"].to_numpy()
    closes = features["close"].to_numpy()
    stoch_k = features["stochK"].to_numpy()
    stoch_d = features["stochD"].to_numpy()
    active_high_cross: StochCrossEvent | None = None
    active_low_cross: StochCrossEvent | None = None

    for index in range(1, rows_count):
        previous_k = stoch_k[index - 1]
        previous_d = stoch_d[index - 1]
        k = stoch_k[index]
        d = stoch_d[index]

        current_dead_cross = _create_cross_event("dead", index, bar_keys, times, previous_k, previous_d, k, d)
        current_golden_cross = _create_cross_event("golden", index, bar_keys, times, previous_k, previous_d, k, d)

        if bool(getattr(settings, "show_high", True)) or bool(getattr(settings, "show_resistance_level", False)):
            if active_high_cross is not None and current_golden_cross is not None:
                active_high_cross = None
            if active_high_cross is not None and finite_number(k):
                confirm = _confirm_high_cross(active_high_cross, index, bar_keys, times, k, settings)
                if confirm is None and _is_confirmation_expired(active_high_cross, index, getattr(settings, "high_confirm_lookahead_bars", 7)):
                    active_high_cross = None
                elif confirm is not None:
                    signal = _create_high_signal(confirm, highs, closes, bar_keys, times, settings)
                    if signal is not None:
                        signals.append(signal)
                    active_high_cross = None
            if current_dead_cross is not None:
                active_high_cross = current_dead_cross

        if bool(getattr(settings, "show_low", True)) or bool(getattr(settings, "show_support_level", False)):
            if active_low_cross is not None and current_dead_cross is not None:
                active_low_cross = None
            if active_low_cross is not None and finite_number(k):
                confirm = _confirm_low_cross(active_low_cross, index, bar_keys, times, k, settings)
                if confirm is None and _is_confirmation_expired(active_low_cross, index, getattr(settings, "low_confirm_lookahead_bars", 7)):
                    active_low_cross = None
                elif confirm is not None:
                    signal = _create_low_signal(confirm, lows, closes, bar_keys, times, settings)
                    if signal is not None:
                        signals.append(signal)
                    active_low_cross = None
            if current_golden_cross is not None:
                active_low_cross = current_golden_cross

    return sorted(signals, key=lambda signal: (signal.anchor.index, signal.type))


def _create_cross_event(
    direction: StochCrossDirection,
    index: int,
    bar_keys: object,
    times: object,
    previous_k: object,
    previous_d: object,
    k: object,
    d: object,
) -> StochCrossEvent | None:
    value = dead_cross_value(previous_k, previous_d, k, d) if direction == "dead" else golden_cross_value(previous_k, previous_d, k, d)
    if value is None:
        return None
    return StochCrossEvent(
        direction=direction,
        index=index,
        bar_key=str(bar_keys[index]),
        time=int(times[index]),
        value=float(value),
        k=float(k),
        d=float(d),
        previous_index=index - 1,
        previous_k=float(previous_k),
        previous_d=float(previous_d),
    )


def _confirm_high_cross(cross: StochCrossEvent, index: int, bar_keys: object, times: object, k: object, settings: object) -> StochConfirmEvent | None:
    max_bars = _confirm_lookahead_bars(getattr(settings, "high_confirm_lookahead_bars", 7))
    advance = float(getattr(settings, "high_stoch_k_advance", 10))
    if index <= cross.index or index - cross.index > max_bars or not finite_number(k):
        return None
    if float(k) > cross.value - advance:
        return None
    return _create_confirm_event(cross, index, bar_keys, times, k, advance, max_bars)


def _confirm_low_cross(cross: StochCrossEvent, index: int, bar_keys: object, times: object, k: object, settings: object) -> StochConfirmEvent | None:
    max_bars = _confirm_lookahead_bars(getattr(settings, "low_confirm_lookahead_bars", 7))
    advance = float(getattr(settings, "low_stoch_k_advance", 10))
    if index <= cross.index or index - cross.index > max_bars or not finite_number(k):
        return None
    if float(k) < cross.value + advance:
        return None
    return _create_confirm_event(cross, index, bar_keys, times, k, advance, max_bars)


def _create_confirm_event(cross: StochCrossEvent, index: int, bar_keys: object, times: object, k: object, advance: float, max_bars: int) -> StochConfirmEvent:
    return StochConfirmEvent(
        cross=cross,
        index=index,
        bar_key=str(bar_keys[index]),
        time=int(times[index]),
        k=float(k),
        advance=advance,
        bars_used=index - cross.index,
        max_bars=max_bars,
    )


def _create_high_signal(confirm: StochConfirmEvent, highs: object, closes: object, bar_keys: object, times: object, settings: object) -> StochStateSignal | None:
    start_index = _anchor_start_index(confirm.cross.index, getattr(settings, "high_anchor_lookback_bars", 14))
    end_index = confirm.cross.index
    marker_index = highest_high_index(highs, start_index, end_index)
    if marker_index is None:
        return None
    marker_price = float(highs[marker_index])
    entry_price = float(closes[confirm.index])
    anchor = _create_anchor("high", marker_index, marker_price, start_index, end_index, bar_keys, times)
    return StochStateSignal(
        type="high",
        cross=confirm.cross,
        confirm=confirm,
        anchor=anchor,
        entry_index=confirm.index,
        entry_bar_key=confirm.bar_key,
        entry_time=confirm.time,
        entry_price=entry_price,
        point_distance=abs(entry_price - marker_price),
    )


def _create_low_signal(confirm: StochConfirmEvent, lows: object, closes: object, bar_keys: object, times: object, settings: object) -> StochStateSignal | None:
    start_index = _anchor_start_index(confirm.cross.index, getattr(settings, "low_anchor_lookback_bars", 14))
    end_index = confirm.cross.index
    marker_index = lowest_low_index(lows, start_index, end_index)
    if marker_index is None:
        return None
    marker_price = float(lows[marker_index])
    entry_price = float(closes[confirm.index])
    anchor = _create_anchor("low", marker_index, marker_price, start_index, end_index, bar_keys, times)
    return StochStateSignal(
        type="low",
        cross=confirm.cross,
        confirm=confirm,
        anchor=anchor,
        entry_index=confirm.index,
        entry_bar_key=confirm.bar_key,
        entry_time=confirm.time,
        entry_price=entry_price,
        point_distance=abs(entry_price - marker_price),
    )


def _create_anchor(anchor_type: PriceAnchorType, marker_index: int, marker_price: float, start_index: int, end_index: int, bar_keys: object, times: object) -> PriceAnchor:
    return PriceAnchor(
        type=anchor_type,
        index=marker_index,
        bar_key=str(bar_keys[marker_index]),
        time=int(times[marker_index]),
        price=marker_price,
        window_start_index=start_index,
        window_start_bar_key=str(bar_keys[start_index]),
        window_start_time=int(times[start_index]),
        window_end_index=end_index,
        window_end_bar_key=str(bar_keys[end_index]),
        window_end_time=int(times[end_index]),
    )


def _anchor_start_index(cross_index: int, lookback_bars: int) -> int:
    safe_lookback = max(1, int(lookback_bars or 1))
    return max(0, cross_index - (safe_lookback - 1))


def _confirm_lookahead_bars(value: int) -> int:
    return max(1, int(value or 1))


def _is_confirmation_expired(cross: StochCrossEvent, index: int, lookahead_bars: int) -> bool:
    return index - cross.index > _confirm_lookahead_bars(lookahead_bars)
