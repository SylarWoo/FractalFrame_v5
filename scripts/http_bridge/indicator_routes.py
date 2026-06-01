from __future__ import annotations

import json
from typing import Any
from urllib.parse import ParseResult, parse_qs

from .response import error_payload

MAX_INDICATOR_REQUEST_BYTES = 8 * 1024 * 1024


def handle_indicator_get(handler: Any, parsed: ParseResult, services: Any) -> bool:
    if parsed.path == "/api/indicators/v3/mmf/jobs/result":
        query = parse_qs(parsed.query)
        job_id = str((query.get("jobId") or query.get("job_id") or [""])[0]).strip()
        if not job_id:
            handler.send_json(400, error_payload("bad_request", "job_id_required"))
            return True
        payload = services.get_mmf_v3_indicator_job(job_id)
        handler.send_json(200 if payload.get("ok") is True else 404, payload)
        return True

    if parsed.path == "/api/indicators/v2/mmf/jobs/result":
        query = parse_qs(parsed.query)
        job_id = str((query.get("jobId") or query.get("job_id") or [""])[0]).strip()
        if not job_id:
            handler.send_json(400, error_payload("bad_request", "job_id_required"))
            return True
        payload = services.get_mmf_v2_indicator_job(job_id)
        handler.send_json(200 if payload.get("ok") is True else 404, payload)
        return True

    if parsed.path != "/api/indicators/v1/mmf":
        return False
    try:
        payload = services.query_mmf_indicator(parse_qs(parsed.query), store_root=handler.store_root)
        handler.send_json(200 if payload.get("ok") is True else 400, payload)
    except Exception as exc:
        handler.send_json(500, error_payload("mmf_indicator_failed", str(exc)))
    return True


def handle_indicator_post(handler: Any, parsed: ParseResult, services: Any) -> bool:
    if parsed.path not in {"/api/indicators/v1/mmf/calculate", "/api/indicators/v2/mmf/calculate", "/api/indicators/v2/mmf/jobs/start", "/api/indicators/v3/mmf/calculate", "/api/indicators/v3/mmf/jobs/start", "/api/indicators/v1/vmi/calculate"}:
        return False
    try:
        payload = _read_json_payload(handler)
        if not isinstance(payload, dict):
            handler.send_json(400, error_payload("bad_request", "json_object_required"))
            return True
        if parsed.path == "/api/indicators/v3/mmf/jobs/start":
            result = services.start_mmf_v3_indicator_job(payload)
        elif parsed.path == "/api/indicators/v3/mmf/calculate":
            result = services.calculate_mmf_v3_indicator_from_rows(payload)
        elif parsed.path == "/api/indicators/v2/mmf/jobs/start":
            result = services.start_mmf_v2_indicator_job(payload)
        elif parsed.path == "/api/indicators/v2/mmf/calculate":
            result = services.calculate_mmf_v2_indicator_from_rows(payload)
        elif parsed.path == "/api/indicators/v1/vmi/calculate":
            result = services.calculate_vmi_indicator_from_rows(payload)
        else:
            result = services.calculate_mmf_indicator_from_rows(payload)
        handler.send_json(200 if result.get("ok") is True else 400, result)
    except ValueError as exc:
        handler.send_json(400, error_payload("bad_request", str(exc)))
    except Exception as exc:
        handler.send_json(500, error_payload("mmf_indicator_failed", str(exc)))
    return True


def _read_json_payload(handler: Any) -> Any:
    try:
        length = int(handler.headers.get("Content-Length") or "0")
    except ValueError as exc:
        raise ValueError("invalid_content_length") from exc
    if length < 0:
        raise ValueError("invalid_content_length")
    if length > MAX_INDICATOR_REQUEST_BYTES:
        raise ValueError("request_body_too_large")
    raw = handler.rfile.read(length) if length > 0 else b"{}"
    try:
        return json.loads(raw.decode("utf-8"))
    except UnicodeDecodeError as exc:
        raise ValueError("request_body_must_be_utf8") from exc
    except json.JSONDecodeError as exc:
        raise ValueError("invalid_json") from exc
