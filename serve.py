#!/usr/bin/env python3
"""
Preview HELORA on your own machine.

    python3 serve.py

Then open http://localhost:8788 in a browser.
Press Ctrl+C to stop. Nothing here is needed to deploy — Cloudflare serves
the files directly.
"""
import functools
import http.server
import os
import socketserver

PORT = int(os.environ.get("PORT", "8788"))
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Don't cache while developing, so a reload always shows your edits.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    handler = functools.partial(Handler, directory=ROOT)
    with socketserver.TCPServer(("127.0.0.1", PORT), handler) as httpd:
        print(f"HELORA is running at http://localhost:{PORT}")
        print("Press Ctrl+C to stop.")
        httpd.serve_forever()
