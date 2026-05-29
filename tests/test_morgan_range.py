from __future__ import annotations

import pandas as pd
import pytest

from python.indicators.mmf_v2.features import calculate_morgan_feature
from python.indicators.morgan_range import (
    calculate_morgan_level_model,
    resolve_morgan_center_from_model,
    resolve_morgan_levels_from_model,
    resolve_morgan_true_range_from_model,
)


def row(index: int, price: float) -> dict:
    return {
        "time": 1_700_000_000 + index * 4 * 60 * 60,
        "open": price,
        "high": price + 1,
        "low": price - 1,
        "close": price,
        "volume": 1,
    }


def test_morgan_true_range_is_red_zone_height() -> None:
    frame = pd.DataFrame([row(index, 100) for index in range(9)])

    level_model, _segment_indexes = calculate_morgan_level_model(frame)
    upper = resolve_morgan_levels_from_model(level_model, 0.236)
    lower = resolve_morgan_levels_from_model(level_model, -0.236)
    true_range = resolve_morgan_true_range_from_model(level_model)
    center = resolve_morgan_center_from_model(level_model)

    first_valid = int(true_range.first_valid_index())
    assert float(center.iloc[first_valid]) == pytest.approx(100)
    assert float(true_range.iloc[first_valid]) == pytest.approx(float(upper.iloc[first_valid] - lower.iloc[first_valid]))
    assert float(true_range.iloc[first_valid]) == pytest.approx(2 * 3 * (0.236 - (-0.236)))


def test_mmf_v2_morgan_feature_exposes_true_range_field() -> None:
    frame = pd.DataFrame([row(index, 100) for index in range(9)])

    features = calculate_morgan_feature(frame)

    assert "morgan_true_range" in features.columns
    assert "morgan_center" in features.columns
    first_valid = int(features["morgan_true_range"].first_valid_index())
    assert float(features["morgan_center"].iloc[first_valid]) == pytest.approx(100)
    assert float(features["morgan_true_range"].iloc[first_valid]) == pytest.approx(float(features["morgan_0_236"].iloc[first_valid] - features["morgan_neg_0_236"].iloc[first_valid]))
