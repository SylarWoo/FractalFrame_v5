from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


ReplayStatus = Literal["idle", "playing", "paused"]


@dataclass
class ReplayController:
    sourceRows: list[dict[str, Any]]
    currentIndex: int = 0
    status: ReplayStatus = "idle"
    speed: float = 1.0
    stepSize: int = 1
    _index_by_bar_key: dict[str, int] = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self._index_by_bar_key = {
            str(row["barKey"]): index
            for index, row in enumerate(self.sourceRows)
            if row.get("barKey") is not None
        }
        self.currentIndex = self._clamp(self.currentIndex)

    @property
    def visibleRows(self) -> list[dict[str, Any]]:
        return self.sourceRows[: self.currentIndex + 1]

    def play(self) -> None:
        self.status = "playing"

    def pause(self) -> None:
        self.status = "paused"

    def step_forward(self, steps: int | None = None) -> int:
        self.currentIndex = self._clamp(self.currentIndex + (steps or self.stepSize))
        return self.currentIndex

    def step_backward(self, steps: int | None = None) -> int:
        self.currentIndex = self._clamp(self.currentIndex - (steps or self.stepSize))
        return self.currentIndex

    def jump_to_index(self, index: int) -> int:
        self.currentIndex = self._clamp(index)
        return self.currentIndex

    def jump_to_bar_key(self, bar_key: str) -> int:
        if bar_key not in self._index_by_bar_key:
            raise KeyError(f"Unknown barKey: {bar_key}")
        self.currentIndex = self._index_by_bar_key[bar_key]
        return self.currentIndex

    def truncate_rows(self, rows: list[dict[str, Any]], *, index_key: str = "sourceIndex") -> list[dict[str, Any]]:
        return [row for row in rows if int(row.get(index_key, -1)) <= self.currentIndex]

    def _clamp(self, index: int) -> int:
        if not self.sourceRows:
            return 0
        return max(0, min(int(index), len(self.sourceRows) - 1))
