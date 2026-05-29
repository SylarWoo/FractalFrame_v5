from python.indicators.mmf_v2 import MmfV2Settings, calculate_mmf_v2_markers
from python.indicators.mmf_v2.signal_catalog import get_mmf_v2_signal_catalog, get_mmf_v2_signal_catalog_payload


def test_mmf_v2_signal_catalog_exposes_strategy_metadata() -> None:
    catalog = get_mmf_v2_signal_catalog()
    by_id = {entry["catalogId"]: entry for entry in catalog}

    assert by_id["MMF_V2_TREND_DOWN_RETURN"]["strategyIntent"] == "short_entry_candidate"
    assert by_id["MMF_V2_SUPPORT_DOWN_BREAK"]["role"] == "trend_open"
    assert by_id["MMF_V2_RESISTANCE_DOWN_BREAK"]["role"] == "trend_close"
    assert by_id["MMF_V2_EXPECTED_SUPPORT"]["layer"] == "replacement"


def test_mmf_v2_marker_payload_includes_catalog_fields() -> None:
    rows = []
    for index in range(60):
        close = 100 + index
        rows.append({
            "time": 1_700_000_000 + index * 300,
            "open": close,
            "high": close + 2,
            "low": close - 2,
            "close": close,
        })

    payload = calculate_mmf_v2_markers(rows, MmfV2Settings(show_high=True, show_low=False))

    assert "signalCatalog" in payload
    if payload["markers"]:
        marker = payload["markers"][0]
        assert marker["catalogId"] == marker["type"]
        assert "strategyIntent" in marker
        assert "defaultStyle" in marker


def test_unknown_mmf_v2_catalog_payload_is_still_stable() -> None:
    assert get_mmf_v2_signal_catalog_payload("UNKNOWN") == {"catalogId": "UNKNOWN"}
