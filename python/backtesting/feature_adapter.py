from __future__ import annotations

from typing import Any

import pandas as pd

BACKTEST_COORDINATE_COLUMNS = ["barKey", "sourceIndex", "time"]


def build_feature_table(features: pd.DataFrame) -> pd.DataFrame:
    """Return a normalized Feature Table with stable bar coordinates first."""
    if features.empty:
        return pd.DataFrame(columns=BACKTEST_COORDINATE_COLUMNS)

    missing = [name for name in BACKTEST_COORDINATE_COLUMNS if name not in features.columns]
    if missing:
        raise ValueError(f"Feature Table missing coordinate columns: {', '.join(missing)}")

    table = features.copy()
    table["barKey"] = table["barKey"].astype(str)
    table["sourceIndex"] = pd.to_numeric(table["sourceIndex"], errors="coerce").astype("Int64")
    table["time"] = pd.to_numeric(table["time"], errors="coerce").astype("Int64")
    table = table.dropna(subset=BACKTEST_COORDINATE_COLUMNS).reset_index(drop=True)
    ordered_columns = [*BACKTEST_COORDINATE_COLUMNS, *[name for name in table.columns if name not in BACKTEST_COORDINATE_COLUMNS]]
    return table.loc[:, ordered_columns]


def feature_table_to_records(features: pd.DataFrame) -> list[dict[str, Any]]:
    return build_feature_table(features).to_dict(orient="records")
