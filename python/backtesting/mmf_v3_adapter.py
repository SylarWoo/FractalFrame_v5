from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd

from python.indicators.mmf_v3.feature_frame import build_mmf_v3_feature_frame
from python.indicators.mmf_v3.models import MmfV3Settings
from python.indicators.mmf_v3.signal_catalog import get_mmf_v3_signal_catalog
from python.indicators.mmf_v3.signal_decision import calculate_mmf_v3_signal_decisions

from .feature_adapter import build_feature_table
from .market_data_adapter import build_market_data_table
from .signal_adapter import build_signal_table_from_mmf_v3


@dataclass(frozen=True)
class MmfV3BacktestTables:
    marketDataTable: pd.DataFrame
    featureTable: pd.DataFrame
    signalTable: list[dict[str, Any]]
    signalCatalog: list[dict[str, Any]]
    markers: list[dict[str, Any]]

    def to_payload(self) -> dict[str, Any]:
        return {
            "marketDataTable": self.marketDataTable.to_dict(orient="records"),
            "featureTable": self.featureTable.to_dict(orient="records"),
            "signalTable": self.signalTable,
            "signalCatalog": self.signalCatalog,
            "markers": self.markers,
            "counts": {
                "marketDataRows": int(len(self.marketDataTable)),
                "featureRows": int(len(self.featureTable)),
                "signalRows": int(len(self.signalTable)),
                "markers": int(len(self.markers)),
            },
        }


def build_mmf_v3_backtest_tables(
    rows: list[dict[str, Any]] | pd.DataFrame,
    *,
    symbol: str,
    timeframe: str,
    settings: MmfV3Settings | None = None,
) -> MmfV3BacktestTables:
    """Build the backend tables shared by strategy, backtest, and later chart rendering."""
    active_settings = settings or MmfV3Settings()
    market_data = build_market_data_table(rows, symbol=symbol, timeframe=timeframe)
    feature_frame = build_mmf_v3_feature_frame(market_data, active_settings).frame
    feature_table = build_feature_table(feature_frame)
    decision_result = calculate_mmf_v3_signal_decisions(feature_table, active_settings, include_decision_frame=False)
    signal_table = build_signal_table_from_mmf_v3(feature_table, decision_result.markers, source="MMF_V3")

    return MmfV3BacktestTables(
        marketDataTable=market_data,
        featureTable=feature_table,
        signalTable=signal_table,
        signalCatalog=get_mmf_v3_signal_catalog(),
        markers=[marker.to_payload() for marker in decision_result.markers],
    )
