from __future__ import annotations

import threading

_LOCK = threading.Lock()
_ACTIVE: set[tuple[str, str]] = set()


def try_start_operation(symbol: str, operation: str) -> bool:
    key = (symbol, operation)
    with _LOCK:
        if key in _ACTIVE:
            return False
        _ACTIVE.add(key)
        return True


def finish_operation(symbol: str, operation: str) -> None:
    with _LOCK:
        _ACTIVE.discard((symbol, operation))


def active_operations() -> list[dict[str, str]]:
    with _LOCK:
        return [{"symbol": symbol, "operation": operation} for symbol, operation in sorted(_ACTIVE)]
