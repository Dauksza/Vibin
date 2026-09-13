"""The 6-layer verification contract stack. System owns verdicts; models never grade themselves."""
from __future__ import annotations
import hashlib, json, subprocess
from dataclasses import dataclass
from pathlib import Path

LAYERS = ("L0", "L1", "L2", "L3", "L4", "L5")
NAMES = {
    "L0": "typecheck/build",
    "L1": "unit + property",
    "L2": "api contract",
    "L3": "browser script",
    "L4": "visual diff",
    "L5": "judge + evidence"
}

@dataclass
class Result:
    layer: str
    status: str
    detail: str = ""
    evidence: str = ""

    def to_dict(self):
        return {
            "layer": self.layer,
            "name": NAMES[self.layer],
            "status": self.status,
            "detail": self.detail,
            "evidence": self.evidence
        }

def _run(cmd, cwd, timeout=300):
    try:
        r = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        tail = "\n".join((r.stdout + r.stderr).splitlines()[-30:])
        return r.returncode == 0, tail
    except subprocess.TimeoutExpired:
        return False, f"timeout after {timeout}s"

def _hash(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()[:16]

class Stack:
    def __init__(self, root, manifest, bus, judge=None, evidence=None):
        self.root = Path(root)
        self.m = manifest
        self.bus = bus
        self.judge = judge
        self.evidence = evidence
        self.results = []

    def run(self, layers=LAYERS):
        self.results = []
        for L in layers:
            res = getattr(self, "_" + L.lower())()
            self.results.append(res)
            self.bus.emit("contract", f"{L} {res.status} — {res.detail}", layer=L, status=res.status, detail=res.detail)
        return self.results

    def verdict(self):
        return all(r.status != "fail" for r in self.results)

    def _cmd_layer(self, L, key):
        cmd = self.m["commands"].get(key, "")
        if not cmd:
            return Result(L, "skip", "not configured")
        ok, tail = _run(cmd, self.root)
        ev = ""
        if self.evidence is not None:
            ev = self.evidence.add_text(f"{L.lower()}.log", tail)
        return Result(L, "pass" if ok else "fail", "ok" if ok else "command failed", ev)

    def _l0(self):
        return self._cmd_layer("L0", "build")

    def _l1(self):
        return self._cmd_layer("L1", "test")

    def _l2(self):
        return self._cmd_layer("L2", "contract")

    def _l3(self):
        return self._cmd_layer("L3", "browser")

    def _l4(self):
        watch = self.m["visual"].get("watch", [])
        if not watch:
            return Result("L4", "skip", "no watch list")
        base_file = self.root / ".forge" / "visual_baseline.json"
        baseline = json.loads(base_file.read_text()) if base_file.exists() else {}
        changed = []
        missing = []
        for rel in watch:
            p = self.root / rel
            if not p.exists():
                missing.append(rel)
                continue
            if baseline.get(rel) != _hash(p):
                changed.append(rel)
        if missing or changed:
            detail = "unexpected change: " + ", ".join(changed + missing)
            return Result("L4", "fail", detail)
        return Result("L4", "pass", "100.0% scoped match")

    def _l5(self):
        if self.judge is None:
            return Result("L5", "skip", "no judge configured")
        summary = "\n".join(f"{r.layer} {r.status} {r.detail}" for r in self.results)
        bundle = self.evidence.summary() if self.evidence is not None else "(no evidence files)"
        passed = self.judge(summary, bundle)
        return Result("L5", "pass" if passed else "fail", "accept" if passed else "reject")
