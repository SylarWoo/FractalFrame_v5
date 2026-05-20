from __future__ import annotations

import unittest

from scripts.http_bridge.route_helpers import first_query_value, parse_timeframes, required_job_id, required_symbol


class HttpBridgeRouteHelperTests(unittest.TestCase):
    def test_first_query_value_accepts_aliases(self) -> None:
        self.assertEqual(first_query_value({"job_id": ["abc"]}, "jobId", "job_id"), "abc")
        self.assertEqual(first_query_value({}, "missing", default="fallback"), "fallback")

    def test_required_values_trim_whitespace(self) -> None:
        self.assertEqual(required_symbol({"symbol": [" XAUUSDm "]}), "XAUUSDm")
        self.assertEqual(required_job_id({"jobId": [" job-1 "]}), "job-1")

    def test_parse_timeframes_normalizes_and_filters(self) -> None:
        self.assertEqual(parse_timeframes("m1, h4,, d1 "), ["M1", "H4", "D1"])
        self.assertEqual(parse_timeframes("", default="M5,H1"), ["M5", "H1"])


if __name__ == "__main__":
    unittest.main()
