from __future__ import annotations

import pandas as pd

from .features import finite_number
from .stoch_confirmation import confirm_high_cross, confirm_low_cross, is_confirmation_expired
from .stoch_cross_detection import create_cross_event
from .stoch_models import PriceAnchor, PriceAnchorType, StochConfirmEvent, StochCrossDirection, StochCrossEvent, StochStateSignal
from .stoch_signal_factory import create_high_signal, create_low_signal

__all__ = [
    "PriceAnchor",
    "PriceAnchorType",
    "StochConfirmEvent",
    "StochCrossDirection",
    "StochCrossEvent",
    "StochStateSignal",
    "calculate_stoch_state_signals",
]


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

        current_dead_cross = create_cross_event("dead", index, bar_keys, times, previous_k, previous_d, k, d)
        current_golden_cross = create_cross_event("golden", index, bar_keys, times, previous_k, previous_d, k, d)

        if bool(getattr(settings, "show_high", True)) or bool(getattr(settings, "show_resistance_level", False)):
            if active_high_cross is not None and current_golden_cross is not None:
                active_high_cross = None
            if active_high_cross is not None and finite_number(k):
                confirm = confirm_high_cross(active_high_cross, index, bar_keys, times, k, settings)
                if confirm is None and is_confirmation_expired(active_high_cross, index, getattr(settings, "high_confirm_lookahead_bars", 7)):
                    active_high_cross = None
                elif confirm is not None:
                    signal = create_high_signal(confirm, highs, closes, bar_keys, times, settings)
                    if signal is not None:
                        signals.append(signal)
                    active_high_cross = None
            if current_dead_cross is not None:
                active_high_cross = current_dead_cross

        if bool(getattr(settings, "show_low", True)) or bool(getattr(settings, "show_support_level", False)):
            if active_low_cross is not None and current_dead_cross is not None:
                active_low_cross = None
            if active_low_cross is not None and finite_number(k):
                confirm = confirm_low_cross(active_low_cross, index, bar_keys, times, k, settings)
                if confirm is None and is_confirmation_expired(active_low_cross, index, getattr(settings, "low_confirm_lookahead_bars", 7)):
                    active_low_cross = None
                elif confirm is not None:
                    signal = create_low_signal(confirm, lows, closes, bar_keys, times, settings)
                    if signal is not None:
                        signals.append(signal)
                    active_low_cross = None
            if current_golden_cross is not None:
                active_low_cross = current_golden_cross

    return sorted(signals, key=lambda signal: (signal.anchor.index, signal.type))
