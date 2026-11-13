"""
Zero-dependency Flask-compatible micro-adapter used ONLY when Flask is not installed
in the runtime container, allowing backend/app.py to execute the exact same REST API
routes using Python's built-in ThreadingHTTPServer.
"""

from __future__ import annotations
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable, Dict, List, Optional, Tuple
from urllib.parse import parse_qs, urlparse


class CompatRequest:
    def __init__(self, method: str, path: str, query: Dict[str, List[str]], headers: Dict[str, str], body: bytes):
        self.method = method
        self.path = path
        self.args = {k: v[0] if len(v) == 1 else v for k, v in query.items()}
        self.headers = headers
        self._body = body
        self._json_cache: Any = None

    def get_json(self, silent: bool = False) -> Any:
        if self._json_cache is not None:
            return self._json_cache
        if not self._body:
            return {} if silent else None
        try:
            self._json_cache = json.loads(self._body.decode("utf-8"))
            return self._json_cache
        except Exception:
            if silent:
                return {}
            raise


class CompatResponse:
    def __init__(self, body: Any, status: int = 200, headers: Optional[Dict[str, str]] = None):
        self.body = body
        self.status = status
        self.headers = headers or {"Content-Type": "application/json"}


def jsonify(data: Any) -> CompatResponse:
    return CompatResponse(json.dumps(data), 200, {"Content-Type": "application/json"})


class _RequestProxy:
    def __init__(self) -> None:
        self._current: Optional[CompatRequest] = None

    def _set(self, req: Optional[CompatRequest]) -> None:
        self._current = req

    def __getattr__(self, name: str) -> Any:
        if self._current is None:
            raise RuntimeError("Outside request context")
        return getattr(self._current, name)


request = _RequestProxy()


class MicroFlask:
    def __init__(self, import_name: str):
        self.import_name = import_name
        self.routes: List[Tuple[re.Pattern[str], List[str], Callable[..., Any]]] = []

    def route(self, rule: str, methods: Optional[List[str]] = None) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        allowed = [m.upper() for m in (methods or ["GET"])]
        regex_str = re.sub(r"<(?:int:)?([a-zA-Z_][a-zA-Z0-9_]*)>", r"(?P<\1>[^/]+)", rule)
        compiled = re.compile(f"^{regex_str}$")

        def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
            self.routes.append((compiled, allowed, fn))
            return fn

        return decorator

    def dispatch(self, method: str, raw_url: str, headers: Dict[str, str], body: bytes) -> Tuple[int, Dict[str, str], bytes]:
        parsed = urlparse(raw_url)
        path = parsed.path
        if method.upper() == "OPTIONS":
            return 204, self._cors_headers(), b""

        for pattern, allowed, fn in self.routes:
            m = pattern.match(path)
            if m and method.upper() in allowed:
                req = CompatRequest(method.upper(), path, parse_qs(parsed.query), headers, body)
                request._set(req)
                try:
                    result = fn(**m.groupdict())
                finally:
                    request._set(None)
                return self._normalize_result(result)

        return 404, {**self._cors_headers(), "Content-Type": "application/json"}, json.dumps({"error": "Endpoint not found"}).encode("utf-8")

    def _cors_headers(self) -> Dict[str, str]:
        return {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
        }

    def _normalize_result(self, result: Any) -> Tuple[int, Dict[str, str], bytes]:
        status = 200
        resp_obj = result
        if isinstance(result, tuple):
            resp_obj, status = result[0], int(result[1])
        if isinstance(resp_obj, CompatResponse):
            headers = {**self._cors_headers(), **resp_obj.headers}
            body_bytes = resp_obj.body.encode("utf-8") if isinstance(resp_obj.body, str) else resp_obj.body
            return status, headers, body_bytes
        if isinstance(resp_obj, (dict, list)):
            headers = {**self._cors_headers(), "Content-Type": "application/json"}
            return status, headers, json.dumps(resp_obj).encode("utf-8")
        return status, {**self._cors_headers(), "Content-Type": "text/plain"}, str(resp_obj).encode("utf-8")

    def run(self, host: str = "127.0.0.1", port: int = 5001, debug: bool = False) -> None:
        flask_app = self

        class Handler(BaseHTTPRequestHandler):
            def _handle(self) -> None:
                length = int(self.headers.get("Content-Length", "0") or "0")
                body = self.rfile.read(length) if length > 0 else b""
                headers = {k: v for k, v in self.headers.items()}
                status, resp_headers, payload = flask_app.dispatch(self.command, self.path, headers, body)
                self.send_response(status)
                for k, v in resp_headers.items():
                    self.send_header(k, v)
                self.end_headers()
                if payload:
                    self.wfile.write(payload)

            def do_GET(self) -> None: self._handle()
            def do_POST(self) -> None: self._handle()
            def do_PATCH(self) -> None: self._handle()
            def do_PUT(self) -> None: self._handle()
            def do_DELETE(self) -> None: self._handle()
            def do_OPTIONS(self) -> None: self._handle()

            def log_message(self, fmt: str, *args: Any) -> None:
                return

        server = ThreadingHTTPServer((host, port), Handler)
        print(f"Lab Fault Reporter Python API listening on http://{host}:{port}")
        server.serve_forever()
