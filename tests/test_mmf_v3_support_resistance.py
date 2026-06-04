import pandas as pd

from python.indicators.mmf_v3.models import MmfV3Settings
from python.indicators.mmf_v3.stoch_models import PriceAnchor, StochConfirmEvent, StochCrossEvent, StochStateSignal
from python.indicators.mmf_v3.support_resistance import classify_vmi_zero_levels


def test_mmf_v3_support_uses_vmi_down_up_zero_window_lowest_stoch_low() -> None:
    features = _features([0.2, -0.3, -0.1, 0.2, 0.3])
    signals = [
        _signal("low", 1, 101),
        _signal("low", 2, 99),
        _signal("low", 4, 97),
        _signal("high", 2, 108),
    ]

    classifications = classify_vmi_zero_levels(
        features,
        signals,
        MmfV3Settings(show_support_level=True, show_resistance_level=True),
    )

    assert classifications == {
        1: ("MMF_V3_SUPPORT", "support_vmi_cross_down_zero_1_to_cross_up_zero_3"),
    }


def test_mmf_v3_resistance_uses_vmi_up_down_zero_window_highest_stoch_high() -> None:
    features = _features([-0.2, 0.4, 0.1, -0.2, -0.3])
    signals = [
        _signal("high", 1, 108),
        _signal("high", 2, 112),
        _signal("high", 4, 116),
        _signal("low", 2, 99),
    ]

    classifications = classify_vmi_zero_levels(
        features,
        signals,
        MmfV3Settings(show_support_level=True, show_resistance_level=True),
    )

    assert classifications == {
        1: ("MMF_V3_RESISTANCE", "resistance_vmi_cross_up_zero_1_to_cross_down_zero_3"),
    }


def test_mmf_v3_zero_windows_ignore_open_regions_without_return_cross() -> None:
    features = _features([0.1, -0.2, -0.3, -0.4])
    signals = [
        _signal("low", 2, 98),
    ]

    classifications = classify_vmi_zero_levels(features, signals, MmfV3Settings(show_support_level=True))

    assert classifications == {}


def _features(vmi_values: list[float]) -> pd.DataFrame:
    rows = []
    for index, vmi in enumerate(vmi_values):
        rows.append({
            "barKey": f"XAUUSD|M5|{index}",
            "close": 100 + index,
            "high": 101 + index,
            "low": 99 + index,
            "open": 100 + index,
            "time": index,
            "vmiHistogram": vmi,
        })
    return pd.DataFrame(rows)


def _signal(side: str, index: int, price: float) -> StochStateSignal:
    cross = StochCrossEvent(
        direction="dead" if side == "high" else "golden",
        index=index,
        bar_key=f"XAUUSD|M5|{index}",
        time=index,
        value=50,
        k=50,
        d=50,
        previous_index=max(0, index - 1),
        previous_k=50,
        previous_d=50,
    )
    confirm = StochConfirmEvent(
        cross=cross,
        index=index,
        bar_key=f"XAUUSD|M5|{index}",
        time=index,
        k=50,
        advance=10,
        bars_used=0,
        max_bars=7,
    )
    anchor = PriceAnchor(
        type="high" if side == "high" else "low",
        index=index,
        bar_key=f"XAUUSD|M5|{index}",
        time=index,
        price=price,
        window_start_index=index,
        window_start_bar_key=f"XAUUSD|M5|{index}",
        window_start_time=index,
        window_end_index=index,
        window_end_bar_key=f"XAUUSD|M5|{index}",
        window_end_time=index,
    )
    return StochStateSignal(
        type=side,  # type: ignore[arg-type]
        cross=cross,
        confirm=confirm,
        anchor=anchor,
        entry_index=index,
        entry_bar_key=f"XAUUSD|M5|{index}",
        entry_time=index,
        entry_price=price,
        point_distance=0,
    )
