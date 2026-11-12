"""A dependency-free, local graphing calculator. Run: python3 app.py."""

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path

from lines import EquationError, compare_lines, parse_line

STATIC = Path(__file__).parent / "static"
ASSETS = {"/": ("index.html", "text/html"), "/app.js": ("app.js", "text/javascript"),
          "/style.css": ("style.css", "text/css")}


class Handler(BaseHTTPRequestHandler):
    def respond(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def json_response(self, status, data):
        self.respond(status, json.dumps(data, allow_nan=False).encode(), "application/json")

    def do_GET(self):
        asset = ASSETS.get(self.path)
        if not asset:
            self.json_response(404, {"error": "Not found"})
            return
        name, content_type = asset
        self.respond(200, (STATIC / name).read_bytes(), content_type)

    def do_POST(self):
        if self.path != "/api/compare":
            self.json_response(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 4096:
                self.json_response(413, {"error": "Request must contain 1–4096 bytes."})
                return
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError("Expected an object with first and second equations.")
            lines, errors = [], {}
            for key in ("first", "second"):
                try:
                    lines.append(parse_line(data.get(key)))
                except EquationError as error:
                    errors[key] = str(error)
            if errors:
                self.json_response(400, {"errors": errors})
                return
            self.json_response(200, {"lines": [line.as_dict() for line in lines],
                                     "result": compare_lines(*lines)})
        except (ValueError, UnicodeDecodeError, RecursionError) as error:
            self.json_response(400, {"error": str(error) or "Invalid request."})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Open http://127.0.0.1:{server.server_port} (Ctrl+C to stop)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
