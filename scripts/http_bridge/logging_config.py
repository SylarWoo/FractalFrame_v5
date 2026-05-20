from __future__ import annotations

import logging
import os
from pathlib import Path


def configure_logging() -> None:
    level_name = os.environ.get("FRACTALFRAME_LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    log_root = Path(os.environ.get("FRACTALFRAME_LOG_ROOT", "runtime_data/logs"))
    log_root.mkdir(parents=True, exist_ok=True)
    handlers: list[logging.Handler] = [logging.StreamHandler(), logging.FileHandler(log_root / "bridge.log", encoding="utf-8")]
    logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(name)s - %(message)s", handlers=handlers)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
