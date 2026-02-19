"""Local HTTP server for OpenFinCh.

Serves the chart page and provides a JSON API for fetching stock data.
"""

import json
import threading
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler

from openfinch.intervals import fetch_all_intervals, fetch_custom_interval
from openfinch.stock_chart import build_chart_html

DEFAULT_SYMBOL = "AAPL"
PORT = 8765


class ChartHandler(BaseHTTPRequestHandler):
    """Handle GET / (chart page) and POST /api/data, /api/custom_interval."""

    def log_message(self, format, *args):
        """Suppress default request logging."""
        pass

    def do_GET(self):
        if self.path == "/" or self.path == "":
            html = build_chart_html(DEFAULT_SYMBOL)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.end_headers()
            self.wfile.write(html.encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8")
        return json.loads(body)

    def _send_json(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def do_POST(self):
        if self.path == "/api/data":
            try:
                req = self._read_json()
                symbol = req.get("symbol", "").strip().upper()
                if not symbol:
                    raise ValueError("Missing symbol")

                datasets = fetch_all_intervals(symbol)

                has_data = any(len(ds["candles"]) > 0 for ds in datasets.values())
                if not has_data:
                    self._send_json(404, {"error": f"No data found for '{symbol}'"})
                    return

                self._send_json(200, {"symbol": symbol, "datasets": datasets})

            except Exception as e:
                self._send_json(500, {"error": str(e)})

        elif self.path == "/api/custom_interval":
            try:
                req = self._read_json()
                symbol = req.get("symbol", "").strip().upper()
                value = int(req.get("value", 0))
                unit = req.get("unit", "").strip().lower()
                if not symbol:
                    raise ValueError("Missing symbol")

                dataset = fetch_custom_interval(symbol, value, unit)

                if not dataset["candles"]:
                    self._send_json(404, {"error": f"No data for '{symbol}' at {value} {unit}"})
                    return

                self._send_json(200, {"dataset": dataset})

            except Exception as e:
                self._send_json(500, {"error": str(e)})


def start_server():
    """Start the local server and open the browser."""
    server = HTTPServer(("127.0.0.1", PORT), ChartHandler)
    url = f"http://127.0.0.1:{PORT}"
    print(f"OpenFinCh running at {url}")
    print("Press Ctrl+C to stop.")

    # Open browser after a short delay
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.shutdown()
