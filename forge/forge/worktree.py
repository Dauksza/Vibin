"""Parallel lanes: each lane gets a git worktree; merges happen behind verification gates."""
from __future__ import annotations
from pathlib import Path
from .realms import git

class WorktreePool:
    def __init__(self, realm):
        self.realm = realm
        self.base = realm.root / ".forge" / "wt"

    def setup(self, lanes):
        self.base.mkdir(parents=True, exist_ok=True)
        for lane in lanes:
            wt = self.base / lane
            git(self.realm.root, "worktree", "remove", "--force", str(wt), check=False)
            git(self.realm.root, "branch", "-D", f"forge/lane-{lane}", check=False)
            git(self.realm.root, "worktree", "add", str(wt), "-b", f"forge/lane-{lane}", "HEAD")

    def path(self, lane):
        return self.base / lane

    def commit(self, lane, msg):
        wt = self.path(lane)
        git(wt, "add", "-A")
        git(wt, "commit", "--allow-empty", "-m", msg)

    def merge(self, lane):
        r = git(self.realm.root, "merge", "--no-ff", "--no-commit", f"forge/lane-{lane}", check=False)
        return r.returncode == 0, (r.stderr or r.stdout).strip()

    def abort(self):
        git(self.realm.root, "merge", "--abort", check=False)

    def finish_merge(self, msg):
        git(self.realm.root, "add", "-A")
        git(self.realm.root, "commit", "--allow-empty", "-m", msg)

    def cleanup(self):
        for p in self.base.glob("*"):
            if p.is_dir():
                git(self.realm.root, "worktree", "remove", "--force", str(p), check=False)
        git(self.realm.root, "worktree", "prune", check=False)
