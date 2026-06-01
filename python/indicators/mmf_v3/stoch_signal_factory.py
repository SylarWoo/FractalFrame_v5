from __future__ import annotations

from .price_anchor import highest_high_index, lowest_low_index
from .stoch_models import PriceAnchor, PriceAnchorType, StochConfirmEvent, StochStateSignal


def create_high_signal(confirm: StochConfirmEvent, highs: object, closes: object, bar_keys: object, times: object, settings: object) -> StochStateSignal | None:
    start_index = anchor_start_index(confirm.cross.index, getattr(settings, "high_anchor_lookback_bars", 14))
    end_index = confirm.cross.index
    marker_index = highest_high_index(highs, start_index, end_index)
    if marker_index is None:
        return None
    marker_price = float(highs[marker_index])
    entry_price = float(closes[confirm.index])
    anchor = create_anchor("high", marker_index, marker_price, start_index, end_index, bar_keys, times)
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


def create_low_signal(confirm: StochConfirmEvent, lows: object, closes: object, bar_keys: object, times: object, settings: object) -> StochStateSignal | None:
    start_index = anchor_start_index(confirm.cross.index, getattr(settings, "low_anchor_lookback_bars", 14))
    end_index = confirm.cross.index
    marker_index = lowest_low_index(lows, start_index, end_index)
    if marker_index is None:
        return None
    marker_price = float(lows[marker_index])
    entry_price = float(closes[confirm.index])
    anchor = create_anchor("low", marker_index, marker_price, start_index, end_index, bar_keys, times)
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


def create_anchor(anchor_type: PriceAnchorType, marker_index: int, marker_price: float, start_index: int, end_index: int, bar_keys: object, times: object) -> PriceAnchor:
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


def anchor_start_index(cross_index: int, lookback_bars: int) -> int:
    safe_lookback = max(1, int(lookback_bars or 1))
    return max(0, cross_index - (safe_lookback - 1))
