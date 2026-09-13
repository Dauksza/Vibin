"""Event bus: single source of truth for execution telemetry and UI streams."""
from __future__ import annotations
import json, threading, time
from pathlib import Path

class Bus:
    def __init__(self, log_path=None, keep=4000):
        self._events = []
        self._lock = threading.Lock()
        self._subs = []
        self.keep = keep
        self.log_path = Path(log_path) if log_path else None
        if self.log_path:
            self.log_path.parent.mkdir(parents=True, exist_ok=True)

    def emit(self, type: str, msg: str = "", **data):
        ev = {"ts": time.time(), "type": type, "msg": msg, "data": data}
        with self._lock:
            self._events.append(ev)
            if len(self._events) > self.keep:
                del self._events[:self.keep // 2]
            subs = list(self._subs)
        if self.log_path:
            try:
                with open(self.log_path, "a") as f:
                    f.write(json.dumps(ev) + "\n")
            except Exception:
                pass
        for fn in subs:
            try:
                fn(ev)
            except Exception:
                pass
        return ev

    def on(self, fn):
        with self._lock:
            self._subs.append(fn)

    def tail(self, n=100):
        with self._lock:
            return list(self._events[-n:])
