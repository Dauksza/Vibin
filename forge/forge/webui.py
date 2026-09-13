"""Local IDE server for Forge."""
from __future__ import annotations
import json, threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from .events import Bus
from .manifest import load as load_manifest

STATIC = Path(__file__).parent / "static"
STATE = {"running": False, "loop": None, "bus": None, "result": None, "root": None, "ollama": None}

def serve(root, port=4141, host="127.0.0.1", ollama="http://localhost:11434"):
    root = str(Path(root).resolve())
    STATE["root"] = root
    STATE["ollama"] = ollama

    from .realms import FileRealm
    realm = FileRealm(root)
    from .ollama import list_models
    try:
        models = list_models(ollama)
    except Exception:
        models = []

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a): pass

        def _json(self, obj, code=200):
            b = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)

        def do_GET(self):
            if self.path.startswith("/api/state"):
                loop = STATE.get("loop")
                bus = STATE.get("bus")
                evs = bus.tail(120) if bus else []
                tasks = [t.to_dict() for t in (loop.tasks if loop else [])]
                contracts = loop.contracts if loop else []
                self._json({
                    "running": STATE["running"],
                    "result": STATE["result"],
                    "events": evs,
                    "tasks": tasks,
                    "contracts": contracts,
                    "checkpoints": [n for n, _ in realm.checkpoints()],
                    "models": [m["name"] for m in models],
                    "manifest": load_manifest(root)
                })
            else:
                f = STATIC / "index.html"
                b = f.read_bytes() if f.exists() else b"<html><body>Forge Studio WebUI</body></html>"
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(b)))
                self.end_headers()
                self.wfile.write(b)

    print(f"forge ui running on http://{host}:{port}")
    ThreadingHTTPServer((host, port), H).serve_forever()
