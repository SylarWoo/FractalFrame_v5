import pandas as pd

from python.backtesting import (
    ReplayController,
    build_feature_table,
    build_market_data_table,
    build_mmf_v2_backtest_tables,
    build_mmf_v3_backtest_tables,
    build_signal_following_decisions,
    build_signal_table_from_mmf_v2,
    build_signal_table_from_mmf_v3,
    build_trade_table_from_decisions,
    create_backtest_bar_key,
)
from python.indicators.mmf_v2.models import create_mmf_v2_marker
from python.indicators.mmf_v3.models import create_mmf_v3_marker


def test_mmf_v2_marker_adapts_to_standard_signal_table() -> None:
    features = _market_frame()
    marker = _marker("MMF_V2_LOW", entry_index=1, marker_index=0, price=100.5)

    rows = build_signal_table_from_mmf_v2(features, [marker])

    assert rows == [{
        "signalId": "MMF_V2|MMF_V2_LOW|EURUSD|M5|1700000300|EURUSD|M5|1700000000",
        "signalType": "MMF_V2_LOW",
        "indicator": "MMF_V2",
        "side": None,
        "direction": "up",
        "role": "base_low",
        "barKey": "EURUSD|M5|1700000300",
        "sourceIndex": 1,
        "time": 1_700_000_300,
        "price": 101,
        "confirmed": True,
        "confirmBarKey": "EURUSD|M5|1700000300",
        "confirmIndex": 1,
        "confirmTime": 1_700_000_300,
        "confirmPrice": None,
        "source": "MMF_V2",
        "reason": ["test"],
        "metrics": {"pointDistance": 0.5},
    }]


def test_mmf_v3_marker_adapts_to_isolated_signal_table() -> None:
    features = _market_frame()
    marker = _marker_v3("MMF_V3_LOW", entry_index=1, marker_index=0, price=100.5)

    rows = build_signal_table_from_mmf_v3(features, [marker])

    assert rows[0]["signalId"].startswith("MMF_V3|MMF_V3_LOW|")
    assert rows[0]["signalType"] == "MMF_V3_LOW"
    assert rows[0]["indicator"] == "MMF_V3"
    assert rows[0]["source"] == "MMF_V3"


def test_signal_following_decisions_build_trade_table_with_bar_keys() -> None:
    market = _market_frame()
    signals = [
        _signal("sig-entry", "MMF_V2_LOW", "up", "EURUSD|M5|1700000300", 1),
        _signal("sig-exit", "MMF_V2_HIGH", "down", "EURUSD|M5|1700000900", 3),
    ]

    decisions = build_signal_following_decisions(market, signals, strategy_id="sample")
    trades = build_trade_table_from_decisions(
        market,
        decisions,
        signals,
        strategy_id="sample",
        symbol="EURUSD",
        timeframe="M5",
    )

    assert decisions[1]["orderSide"] == "buy"
    assert decisions[3]["orderSide"] == "sell"
    assert trades[0]["entryBarKey"] == "EURUSD|M5|1700000300"
    assert trades[0]["exitBarKey"] == "EURUSD|M5|1700000900"
    assert trades[0]["barsHeld"] == 2
    assert trades[0]["pnl"] == 2
    assert trades[0]["status"] == "closed"


def test_replay_controller_truncates_future_rows() -> None:
    rows = _market_frame().to_dict(orient="records")
    replay = ReplayController(rows, currentIndex=1)

    assert [row["barKey"] for row in replay.visibleRows] == [
        "EURUSD|M5|1700000000",
        "EURUSD|M5|1700000300",
    ]

    replay.jump_to_bar_key("EURUSD|M5|1700000900")
    assert replay.currentIndex == 3
    assert len(replay.truncate_rows([{"sourceIndex": 2}, {"sourceIndex": 4}])) == 1


def test_feature_table_requires_coordinate_columns() -> None:
    table = build_feature_table(_market_frame()[["barKey", "sourceIndex", "time", "close"]])

    assert list(table.columns) == ["barKey", "sourceIndex", "time", "close"]
    assert table.iloc[0]["barKey"] == "EURUSD|M5|1700000000"


def test_market_data_table_owns_backtest_bar_coordinates() -> None:
    raw = _market_frame().drop(columns=["symbol", "timeframe", "barKey", "sourceIndex"])

    table = build_market_data_table(raw, symbol="EURUSD", timeframe="M5")

    assert list(table.columns) == [
        "symbol",
        "timeframe",
        "sourceIndex",
        "barKey",
        "time",
        "open",
        "high",
        "low",
        "close",
        "volume",
    ]
    assert table.iloc[0]["sourceIndex"] == 0
    assert table.iloc[0]["barKey"] == create_backtest_bar_key("EURUSD", "M5", 1_700_000_000)


def test_mmf_v2_backtest_tables_share_one_bar_coordinate_set() -> None:
    tables = build_mmf_v2_backtest_tables(_market_frame(), symbol="EURUSD", timeframe="M5")

    assert len(tables.marketDataTable) == 5
    assert len(tables.featureTable) == 5
    assert tables.marketDataTable.iloc[2]["barKey"] == tables.featureTable.iloc[2]["barKey"]
    assert tables.marketDataTable.iloc[2]["sourceIndex"] == tables.featureTable.iloc[2]["sourceIndex"]
    assert isinstance(tables.signalTable, list)
    assert tables.to_payload()["counts"]["featureRows"] == 5


def test_mmf_v2_feature_table_includes_vwap_lines() -> None:
    tables = build_mmf_v2_backtest_tables(_market_frame(), symbol="EURUSD", timeframe="M5")

    assert {"vwap", "vwapUpperBand", "vwapLowerBand"}.issubset(tables.featureTable.columns)
    assert tables.featureTable["vwap"].notna().any()
    assert tables.featureTable["vwapUpperBand"].notna().any()
    assert tables.featureTable["vwapLowerBand"].notna().any()


def test_mmf_v3_backtest_tables_clone_v2_backend_shape() -> None:
    tables = build_mmf_v3_backtest_tables(_market_frame(), symbol="EURUSD", timeframe="M5")

    assert len(tables.marketDataTable) == 5
    assert len(tables.featureTable) == 5
    assert {"vwap", "vwapUpperBand", "vwapLowerBand"}.issubset(tables.featureTable.columns)
    assert all(str(item["catalogId"]).startswith("MMF_V3_") for item in tables.signalCatalog)


def _market_frame() -> pd.DataFrame:
    rows = []
    for index, close in enumerate([100, 101, 102, 103, 104]):
        time = 1_700_000_000 + index * 300
        rows.append({
            "symbol": "EURUSD",
            "timeframe": "M5",
            "sourceIndex": index,
            "barKey": f"EURUSD|M5|{time}",
            "time": time,
            "open": close - 0.25,
            "high": close + 0.5,
            "low": close - 0.5,
            "close": close,
            "volume": 10 + index,
        })
    return pd.DataFrame(rows)


def _marker(marker_type: str, *, entry_index: int, marker_index: int, price: float):
    entry_time = 1_700_000_000 + entry_index * 300
    marker_time = 1_700_000_000 + marker_index * 300
    return create_mmf_v2_marker(
        type=marker_type,  # type: ignore[arg-type]
        event_index=marker_index,
        event_bar_key=f"EURUSD|M5|{marker_time}",
        event_time=marker_time,
        confirm_index=entry_index,
        confirm_bar_key=f"EURUSD|M5|{entry_time}",
        confirm_time=entry_time,
        marker_index=marker_index,
        marker_bar_key=f"EURUSD|M5|{marker_time}",
        marker_time=marker_time,
        marker_price=price,
        entry_index=entry_index,
        entry_bar_key=f"EURUSD|M5|{entry_time}",
        entry_time=entry_time,
        entry_price=101,
        point_distance=0.5,
        window_start_index=marker_index,
        window_start_bar_key=f"EURUSD|M5|{marker_time}",
        window_start_time=marker_time,
        window_end_index=entry_index,
        window_end_bar_key=f"EURUSD|M5|{entry_time}",
        window_end_time=entry_time,
        reason=("test",),
    )


def _marker_v3(marker_type: str, *, entry_index: int, marker_index: int, price: float):
    entry_time = 1_700_000_000 + entry_index * 300
    marker_time = 1_700_000_000 + marker_index * 300
    return create_mmf_v3_marker(
        type=marker_type,  # type: ignore[arg-type]
        event_index=marker_index,
        event_bar_key=f"EURUSD|M5|{marker_time}",
        event_time=marker_time,
        confirm_index=entry_index,
        confirm_bar_key=f"EURUSD|M5|{entry_time}",
        confirm_time=entry_time,
        marker_index=marker_index,
        marker_bar_key=f"EURUSD|M5|{marker_time}",
        marker_time=marker_time,
        marker_price=price,
        entry_index=entry_index,
        entry_bar_key=f"EURUSD|M5|{entry_time}",
        entry_time=entry_time,
        entry_price=101,
        point_distance=0.5,
        window_start_index=marker_index,
        window_start_bar_key=f"EURUSD|M5|{marker_time}",
        window_start_time=marker_time,
        window_end_index=entry_index,
        window_end_bar_key=f"EURUSD|M5|{entry_time}",
        window_end_time=entry_time,
        reason=("test",),
    )


def _signal(signal_id: str, signal_type: str, direction: str, bar_key: str, source_index: int) -> dict:
    return {
        "signalId": signal_id,
        "signalType": signal_type,
        "direction": direction,
        "barKey": bar_key,
        "sourceIndex": source_index,
    }
