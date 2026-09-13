"""Evidence bundles: every diagnose/judge call consumes concrete artifacts, not vibes."""
from __future__ import annotations
import shutil
from pathlib import Path

class Bundle:
    def __init__(self, run_dir):
        self.dir = Path(run_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self._items = []

    def add_text(self, name: str, text: str):
        p = self.dir / name
        p.write_text(text)
        self._items.append((name, str(p)))
        return str(p)

    def add_file(self, path, name=None):
        path = Path(path)
        if not path.exists():
            return ""
        name = name or path.name
        dst = self.dir / name
        shutil.copy2(path, dst)
        self._items.append((name, str(dst)))
        return str(dst)

    def summary(self):
        if not self._items:
            return "(empty bundle)"
        return "\n".join(f"- {n}: {p}" for n, p in self._items)
