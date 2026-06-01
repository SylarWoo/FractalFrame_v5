from __future__ import annotations

from .crosses import dead_cross_value, golden_cross_value
from .stoch_models import StochCrossDirection, StochCrossEvent


def create_cross_event(
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
