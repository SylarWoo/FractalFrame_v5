from __future__ import annotations

import unittest

from python.data_warehouse.mt5.mt5_m1_integrity_validator_v1 import (
    validate_incremental_true_m1_rows_v1,
    validate_true_m1_rows_v1,
)

from .store_v5_test_utils import ANCHOR, make_rows


class IntegrityValidatorTests(unittest.TestCase):
    def test_anchor_first_hour_and_gap_cases(self) -> None:
        ok = validate_true_m1_rows_v1(make_rows(ANCHOR, 120))
        self.assertTrue(ok["ok"])
        self.assertEqual(ok["trueM1RowsCount"], 120)
        self.assertEqual(ok["firstHourTrueRows"], 60)
        self.assertEqual(ok["gapCount"], 0)

        prefixed = validate_true_m1_rows_v1(make_rows(ANCHOR - 300, 125))
        self.assertTrue(prefixed["ok"])
        self.assertEqual(prefixed["discardedBeforeTrueM1RowsCount"], 0)
        self.assertEqual(prefixed["firstTrueM1Time"], ANCHOR - 300)

        non_anchor_start = validate_true_m1_rows_v1(make_rows(ANCHOR + 60, 60))
        self.assertTrue(non_anchor_start["ok"])
        self.assertEqual(non_anchor_start["firstTrueM1Time"], ANCHOR + 60)

        missing_first_hour = make_rows(ANCHOR, 59)
        bad_hour = validate_true_m1_rows_v1(missing_first_hour)
        self.assertFalse(bad_hour["ok"])
        self.assertEqual(bad_hour["error"], "no_true_m1_run_found")

        gap = validate_true_m1_rows_v1(make_rows(ANCHOR, 90, gap_after=64))
        self.assertTrue(gap["ok"])
        self.assertEqual(gap["gapCount"], 1)
        self.assertEqual(gap["firstGap"]["deltaSeconds"], 240)
        self.assertEqual(gap["firstGap"]["missingBarsEstimate"], 3)
        self.assertEqual(gap["trueM1RowsCount"], 90)

    def test_incremental_cases(self) -> None:
        rows = make_rows(ANCHOR, 11)
        ok = validate_incremental_true_m1_rows_v1(rows, last_true_m1_time=ANCHOR + 5 * 60)
        self.assertTrue(ok["ok"])
        self.assertEqual(ok["firstNewTime"], ANCHOR + 6 * 60)

        gap_rows = make_rows(ANCHOR, 6) + make_rows(ANCHOR + 8 * 60, 2)
        gap_ok = validate_incremental_true_m1_rows_v1(gap_rows, last_true_m1_time=ANCHOR + 5 * 60)
        self.assertTrue(gap_ok["ok"])
        self.assertEqual(gap_ok["status"], "incremental_true_m1_with_session_gaps")
        self.assertEqual(gap_ok["gapCount"], 1)
        self.assertEqual(gap_ok["firstGap"]["deltaSeconds"], 180)
        self.assertEqual(gap_ok["firstGap"]["missingBarsEstimate"], 2)
        self.assertEqual(gap_ok["trueM1RowsCount"], 2)
