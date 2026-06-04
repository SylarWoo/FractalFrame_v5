from __future__ import annotations

from pathlib import Path


STORE_VERSION = "store_v6"
SCHEMA_VERSION = "6.0.0"
DEFAULT_PROVIDER = "mt5"
DEFAULT_STORE_DIR = Path("runtime_data") / "store_v6"


def project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def resolve_store_root(store_root: str | Path | None = None) -> Path:
    root = Path(store_root) if store_root is not None else project_root() / DEFAULT_STORE_DIR
    return root.resolve()


def manifests_dir(store_root: str | Path | None = None) -> Path:
    return resolve_store_root(store_root) / "manifests"


def manifest_path(store_root: str | Path | None = None) -> Path:
    return manifests_dir(store_root) / "store_v6_manifest.json"


def dataset_relative_root(*, provider: str, symbol: str, mode: str, timeframe: str, base_timeframe: str | None = None, anchor: str | None = None) -> Path:
    if mode == "raw":
        if timeframe != "M1":
            raise ValueError("StoreV6 raw datasets are currently M1 only")
        return Path("raw") / symbol / "M1"
    if mode == "clean":
        if timeframe != "M1":
            raise ValueError("StoreV6 clean direct datasets are currently M1 only")
        return Path("clean") / symbol / "M1"
    if mode == "aggregated":
        if not base_timeframe or not anchor:
            raise ValueError("StoreV6 aggregated datasets require base_timeframe and anchor")
        return Path("aggregated") / symbol / timeframe / f"base={base_timeframe}" / f"anchor={anchor}"
    if mode == "quality":
        return Path("quality") / symbol / timeframe
    if mode == "index":
        return Path("index") / symbol / timeframe
    raise ValueError(f"Unsupported StoreV6 mode: {mode}")


def dataset_root(*, provider: str, symbol: str, mode: str, timeframe: str, base_timeframe: str | None = None, anchor: str | None = None, store_root: str | Path | None = None) -> Path:
    return resolve_store_root(store_root) / dataset_relative_root(
        provider=provider,
        symbol=symbol,
        mode=mode,
        timeframe=timeframe,
        base_timeframe=base_timeframe,
        anchor=anchor,
    )


def dataset_key(*, provider: str, symbol: str, mode: str, timeframe: str, base_timeframe: str | None = None, anchor: str | None = None) -> str:
    if mode in {"raw", "clean"}:
        return f"{provider}:{symbol}:{mode}:{timeframe}"
    if mode == "aggregated":
        if not base_timeframe or not anchor:
            raise ValueError("StoreV6 aggregated dataset key requires base and anchor")
        return f"{provider}:{symbol}:aggregated:{timeframe}:base={base_timeframe}:anchor={anchor}"
    if mode in {"quality", "index"}:
        return f"{provider}:{symbol}:{mode}:{timeframe}"
    raise ValueError(f"Unsupported StoreV6 mode: {mode}")


def ensure_store_layout(store_root: str | Path | None = None) -> Path:
    root = resolve_store_root(store_root)
    for name in ["raw", "clean", "aggregated", "index", "quality", "sessions", "diagnostics"]:
        (root / name).mkdir(parents=True, exist_ok=True)
    manifests_dir(root).mkdir(parents=True, exist_ok=True)
    return root

