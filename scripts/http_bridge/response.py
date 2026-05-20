from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler
from typing import Any


def send_cors_headers(handler: BaseHTTPRequestHandler) -> None:
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Accept, Content-Type")
    handler.send_header("Cache-Control", "no-store")


def send_json(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    send_cors_headers(handler)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def start_sse(handler: BaseHTTPRequestHandler) -> None:
    handler.send_response(200)
    send_cors_headers(handler)
    handler.send_header("Content-Type", "text/event-stream; charset=utf-8")
    handler.send_header("Connection", "keep-alive")
    handler.end_headers()


def write_sse_event(handler: BaseHTTPRequestHandler, event_id: int, event_name: str, data: dict[str, Any]) -> None:
    handler.wfile.write(f"id: {event_id}\n".encode("utf-8"))
    handler.wfile.write(f"event: {event_name}\n".encode("utf-8"))
    handler.wfile.write(f"data: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8"))
    handler.wfile.flush()
