"""Realm: an isolatable, snapshot-able part of the workspace. File realm is git-backed."""
from __future__ import annotations
import json, subprocess
from pathlib import Path

class GitError(Exception):
    pass

def git(root, *args, check=True):
    r = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, timeout=120)
    if check and r.returncode != 0:
        raise GitError(f"git {' '.join(args)}: {(r.stderr or r.stdout).strip()}")
    return r

class FileRealm:
    """Filesystem realm: snapshot = tag, restore = reset+clean. .forge/ is never committed."""

    def __init__(self, root):
        self.root = Path(root).resolve()
        self.meta = self.root / ".forge"
        self.meta.mkdir(exist_ok=True)
        if not (self.root / ".git").exists():
            git(self.root, "init", "-b", "main")
            excl = self.root / ".git" / "info" / "exclude"
            excl.parent.mkdir(parents=True, exist_ok=True)
            existing = excl.read_text() if excl.exists() else ""
            excl.write_text(existing + "\n# forge state\n.forge/\n")
        git(self.root, "config", "user.email", "forge@local")
        git(self.root, "config", "user.name", "forge")
        if git(self.root, "status", "--porcelain").stdout.strip():
            git(self.root, "add", "-A")
            git(self.root, "commit", "-m", "forge: initial snapshot")
        self._state_file = self.meta / "state.json"
        self._state = json.loads(self._state_file.read_text()) if self._state_file.exists() else {"checkpoint": 0}

    def _save(self):
        self._state_file.write_text(json.dumps(self._state))

    def snapshot(self, label=""):
        self._state["checkpoint"] += 1
        n = self._state["checkpoint"]
        git(self.root, "add", "-A")
        git(self.root, "commit", "--allow-empty", "-m", f"forge checkpoint #{n} {label}".strip())
        git(self.root, "tag", "-f", f"forge/ck-{n}")
        self._save()
        return n

    def restore(self, n):
        git(self.root, "reset", "--hard", f"forge/ck-{n}")
        git(self.root, "clean", "-fd", "--exclude=.forge/")
        self._state["checkpoint"] = n
        self._save()

    def checkpoints(self):
        r = git(self.root, "tag", "--list", "forge/ck-*")
        out = []
        for line in r.stdout.splitlines():
            if not line.strip():
                continue
            num = line.rsplit("-", 1)[-1]
            try:
                out.append((int(num), line))
            except ValueError:
                pass
        return sorted(out)
