from __future__ import annotations

from pathlib import Path


STORE_VERSION = "v5"
SCHEMA_VERSION = "5.0.0"
DEFAULT_PROVIDER = "mt5"
DEFAULT_STORE_DIR = Path("runtime_data") / "market_data_store_v5"


def project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def resolve_store_root(store_root: str | Path | None = None) -> Path:
    root = Path(store_root) if store_root is not None else project_root() / DEFAULT_STORE_DIR
    return root.resolve()


def manifests_dir(store_root: str | Path | None = None) -> Path:
    return resolve_store_root(store_root) / "manifests"


def manifest_path(store_root: str | Path | None = None) -> Path:
    return manifests_dir(store_root) / "manifest_v5.json"


def maintenance_archive_dir(store_root: str | Path | None = None) -> Path:
    return resolve_store_root(store_root) / "maintenance_archive"


def direct_m1_relative_root(provider: str, symbol: str) -> Path:
    return Path("datasets") / f"provider={provider}" / f"symbol={symbol}" / "mode=direct" / "timeframe=M1"


def raw_direct_m1_relative_root(provider: str, symbol: str) -> Path:
    return Path("datasets") / f"provider={provider}" / f"symbol={symbol}" / "mode=raw_direct" / "timeframe=M1"


def aggregated_relative_root(
    provider: str,
    symbol: str,
    timeframe: str,
    base_timeframe: str = "M1",
    anchor: str = "UTC2200",
) -> Path:
    return (
        Path("datasets")
        / f"provider={provider}"
        / f"symbol={symbol}"
        / "mode=aggregated"
        / f"timeframe={timeframe}"
        / f"baseTimeframe={base_timeframe}"
        / f"anchor={anchor}"
    )


def dataset_relative_root(
    *,
    provider: str,
    symbol: str,
    mode: str,
    timeframe: str,
    base_timeframe: str | None = None,
    anchor: str | None = None,
) -> Path:
    if mode == "raw_direct":
        if timeframe != "M1":
            raise ValueError("StoreV5 raw direct datasets are M1 only")
        return raw_direct_m1_relative_root(provider, symbol)
    if mode == "direct":
        if timeframe != "M1":
            raise ValueError("StoreV5 direct datasets are M1 only")
        return direct_m1_relative_root(provider, symbol)
    if mode == "aggregated":
        if not base_timeframe or not anchor:
            raise ValueError("Aggregated datasets require base_timeframe and anchor")
        return aggregated_relative_root(provider, symbol, timeframe, base_timeframe, anchor)
    raise ValueError(f"Unsupported StoreV5 mode: {mode}")


def dataset_root(
    *,
    provider: str,
    symbol: str,
    mode: str,
    timeframe: str,
    base_timeframe: str | None = None,
    anchor: str | None = None,
    store_root: str | Path | None = None,
) -> Path:
    return resolve_store_root(store_root) / dataset_relative_root(
        provider=provider,
        symbol=symbol,
        mode=mode,
        timeframe=timeframe,
        base_timeframe=base_timeframe,
        anchor=anchor,
    )


def dataset_key(
    *,
    provider: str,
    symbol: str,
    mode: str,
    timeframe: str,
    base_timeframe: str | None = None,
    anchor: str | None = None,
) -> str:
    if mode == "raw_direct":
        if timeframe != "M1":
            raise ValueError("Raw Direct StoreV5 dataset key is M1 only")
        return f"{provider}:{symbol}:raw_direct:M1"
    if mode == "direct":
        if timeframe != "M1":
            raise ValueError("Direct StoreV5 dataset key is M1 only")
        return f"{provider}:{symbol}:direct:M1"
    if mode == "aggregated":
        if not base_timeframe or not anchor:
            raise ValueError("Aggregated StoreV5 dataset key requires base and anchor")
        return f"{provider}:{symbol}:aggregated:{timeframe}:base={base_timeframe}:anchor={anchor}"
    raise ValueError(f"Unsupported StoreV5 mode: {mode}")


def ensure_store_layout(store_root: str | Path | None = None) -> Path:
    root = resolve_store_root(store_root)
    (root / "datasets").mkdir(parents=True, exist_ok=True)
    manifests_dir(root).mkdir(parents=True, exist_ok=True)
    (maintenance_archive_dir(root) / "compact").mkdir(parents=True, exist_ok=True)
    (maintenance_archive_dir(root) / "rebuild").mkdir(parents=True, exist_ok=True)
    return root
