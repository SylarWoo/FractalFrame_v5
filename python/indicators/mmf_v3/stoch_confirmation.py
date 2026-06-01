from __future__ import annotations

from .features import finite_number
from .stoch_models import StochConfirmEvent, StochCrossEvent


def confirm_high_cross(cross: StochCrossEvent, index: int, bar_keys: object, times: object, k: object, settings: object) -> StochConfirmEvent | None:
    max_bars = confirm_lookahead_bars(getattr(settings, "high_confirm_lookahead_bars", 7))
    advance = float(getattr(settings, "high_stoch_k_advance", 10))
    if index <= cross.index or index - cross.index > max_bars or not finite_number(k):
        return None
    if float(k) > cross.value - advance:
        return None
    return create_confirm_event(cross, index, bar_keys, times, k, advance, max_bars)


def confirm_low_cross(cross: StochCrossEvent, index: int, bar_keys: object, times: object, k: object, settings: object) -> StochConfirmEvent | None:
    max_bars = confirm_lookahead_bars(getattr(settings, "low_confirm_lookahead_bars", 7))
    advance = float(getattr(settings, "low_stoch_k_advance", 10))
    if index <= cross.index or index - cross.index > max_bars or not finite_number(k):
        return None
    if float(k) < cross.value + advance:
        return None
    return create_confirm_event(cross, index, bar_keys, times, k, advance, max_bars)


def create_confirm_event(cross: StochCrossEvent, index: int, bar_keys: object, times: object, k: object, advance: float, max_bars: int) -> StochConfirmEvent:
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


def is_confirmation_expired(cross: StochCrossEvent, index: int, lookahead_bars: int) -> bool:
    return index - cross.index > confirm_lookahead_bars(lookahead_bars)


def confirm_lookahead_bars(value: int) -> int:
    return max(1, int(value or 1))
