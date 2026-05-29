from python.signals import BarCoordinate, SignalRecord, SignalWindow, signals_to_frame, signals_to_records


def test_signal_record_serializes_for_backtest_and_api() -> None:
    signal = SignalRecord(
        indicator="MMF_V2",
        type="MMF_V2_HIGH",
        event=BarCoordinate(1, "XAUUSD|M5|100", 100),
        confirm=BarCoordinate(3, "XAUUSD|M5|700", 700),
        marker=BarCoordinate(2, "XAUUSD|M5|400", 400, 2010.5),
        entry=BarCoordinate(3, "XAUUSD|M5|700", 700, 2005.25),
        window=SignalWindow(
            start=BarCoordinate(0, "XAUUSD|M5|0", 0),
            end=BarCoordinate(3, "XAUUSD|M5|700", 700),
        ),
        metrics={"pointDistance": 5.25},
        reason=("stoch_dead_cross",),
        catalog={"catalogId": "MMF_V2_HIGH", "role": "base_high", "strategyIntent": "structure_reference"},
    )

    records = signals_to_records([signal])
    assert records[0]["signalId"] == "MMF_V2|MMF_V2_HIGH|XAUUSD|M5|700|XAUUSD|M5|400"
    assert records[0]["entryPrice"] == 2005.25
    assert records[0]["markerPrice"] == 2010.5
    assert records[0]["pointDistance"] == 5.25
    assert records[0]["catalogId"] == "MMF_V2_HIGH"
    assert records[0]["role"] == "base_high"

    frame = signals_to_frame([signal])
    assert list(frame["signalId"]) == [records[0]["signalId"]]
    assert list(frame["entryBarKey"]) == ["XAUUSD|M5|700"]
