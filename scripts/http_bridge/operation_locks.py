from __future__ import annotations

import threading
from typing import Callable

_LOCK = threading.Condition(threading.Lock())
_ACTIVE: set[tuple[str, str]] = set()


def try_start_operation(symbol: str, operation: str) -> bool:
    key = (symbol, operation)
    with _LOCK:
        if key in _ACTIVE:
            return False
        _ACTIVE.add(key)
        return True


def wait_start_operation(symbol: str, operation: str, *, is_cancelled: Callable[[], bool] | None = None, timeout: float = 0.5) -> bool:
    key = (symbol, operation)
    with _LOCK:
        while key in _ACTIVE:
            if is_cancelled and is_cancelled():
                return False
            _LOCK.wait(timeout=timeout)
        _ACTIVE.add(key)
        return True


def finish_operation(symbol: str, operation: str) -> None:
    with _LOCK:
        _ACTIVE.discard((symbol, operation))
        _LOCK.notify_all()


def active_operations() -> list[dict[str, str]]:
    with _LOCK:
        return [{"symbol": symbol, "operation": operation} for symbol, operation in sorted(_ACTIVE)]
