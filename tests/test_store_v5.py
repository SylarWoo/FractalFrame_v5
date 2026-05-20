from __future__ import annotations

import unittest

from .test_store_v5_aggregates import StoreAggregateTests
from .test_store_v5_integrity import IntegrityValidatorTests
from .test_store_v5_pipeline import StorePipelineTests

__all__ = [
    "IntegrityValidatorTests",
    "StoreAggregateTests",
    "StorePipelineTests",
]


if __name__ == "__main__":
    unittest.main()
