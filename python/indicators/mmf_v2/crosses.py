from __future__ import annotations

from typing import Any

from .features import finite_number


def stoch_cross_value(previous_k: Any, previous_d: Any, k: Any, d: Any) -> float | None:
    if not (finite_number(previous_k) and finite_number(previous_d) and finite_number(k) and finite_number(d)):
        return None
    previous_k_float = float(previous_k)
    previous_d_float = float(previous_d)
    k_delta = float(k) - previous_k_float
    d_delta = float(d) - previous_d_float
    denominator = k_delta - d_delta
    if denominator == 0:
        return None
    ratio = (previous_d_float - previous_k_float) / denominator
    if ratio < 0 or ratio > 1:
        return None
    return previous_k_float + k_delta * ratio


def dead_cross_value(previous_k: Any, previous_d: Any, k: Any, d: Any) -> float | None:
    if not (finite_number(previous_k) and finite_number(previous_d) and finite_number(k) and finite_number(d)):
        return None
    if not (float(previous_k) >= float(previous_d) and float(k) < float(d)):
        return None
    return stoch_cross_value(previous_k, previous_d, k, d)


def golden_cross_value(previous_k: Any, previous_d: Any, k: Any, d: Any) -> float | None:
    if not (finite_number(previous_k) and finite_number(previous_d) and finite_number(k) and finite_number(d)):
        return None
    if not (float(previous_k) <= float(previous_d) and float(k) > float(d)):
        return None
    return stoch_cross_value(previous_k, previous_d, k, d)
