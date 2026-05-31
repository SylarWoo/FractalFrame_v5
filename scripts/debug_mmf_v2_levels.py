from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from scripts.http_bridge.mmf_v2_indicator_service import calculate_mmf_v2_indicator_from_rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Debug MMF_V2 VDO support/resistance candidate windows.")
    parser.add_argument("payload", help="Path to a MMF_V2 calculate payload JSON file.")
    parser.add_argument("--around", type=int, default=None, help="Only print debug windows near this row index.")
    parser.add_argument("--radius", type=int, default=80, help="Window radius used with --around.")
    args = parser.parse_args()

    payload_path = Path(args.payload)
    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    payload["includeDebug"] = True
    payload["includeSignalFrame"] = True
    result = calculate_mmf_v2_indicator_from_rows(payload)

    print(f"ok={result.get('ok')} markers={result.get('markersCount')} rows={result.get('rowsCount')} hash={result.get('metadata', {}).get('featureSettingsHash')}")
    print("markers:")
    for marker in result.get("markers", []):
        marker_type = marker.get("type")
        if marker_type not in {"MMF_V2_SUPPORT", "MMF_V2_RESISTANCE"}:
            continue
        index = _safe_int(marker.get("index", marker.get("markerIndex")))
        if not _near(index, args.around, args.radius):
            continue
        print(f"  {marker_type} index={index} price={marker.get('price')} reason={_last_reason(marker)}")

    debug = result.get("debug") if isinstance(result.get("debug"), dict) else {}
    levels = debug.get("vdoLevels") if isinstance(debug.get("vdoLevels"), dict) else {}
    for side in ("support", "resistance"):
        rows = levels.get(side) if isinstance(levels.get(side), list) else []
        print(f"{side} windows:")
        for row in rows:
            selected = _safe_int(row.get("selectedAnchorIndex"))
            start = _safe_int(row.get("vdoStart"))
            end = _safe_int(row.get("vdoEnd"))
            if not (_near(selected, args.around, args.radius) or _near(start, args.around, args.radius) or _near(end, args.around, args.radius)):
                continue
            print(
                "  "
                f"status={row.get('status')} rank={row.get('rank')} level={row.get('level')} "
                f"vdo={row.get('vdoStart')}->{row.get('vdoEnd')} right={row.get('rightSource')} "
                f"vmi={row.get('vmiRegionStart')}->{row.get('vmiRegionEnd')} "
                f"candidates={row.get('candidateCount')} selected={row.get('selectedAnchorIndex')} price={row.get('selectedPrice')}"
            )


def _safe_int(value: Any) -> int | None:
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        return None
    return number


def _near(value: int | None, around: int | None, radius: int) -> bool:
    if around is None:
        return True
    if value is None:
        return False
    return abs(value - around) <= radius


def _last_reason(marker: dict[str, Any]) -> str:
    reason = marker.get("reason")
    if isinstance(reason, list) and reason:
        return str(reason[-1])
    return ""


if __name__ == "__main__":
    main()
