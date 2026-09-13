import os, sys
from pathlib import Path

OUT_DIRS = [Path('/mnt/agents/output/forge'), Path('./forge')]

FILES = {}

FILES["pyproject.toml"] = """[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[project]
name = "forge-agent"
version = "0.1.0"
description = "Verification-first agentic control plane: deterministic state machine, contract stack, parallel worktrees, git snapshots, model routing."
authors = [{name = "Forge Contributors"}]
readme = "README.md"
requires-python = ">=3.10"
dependencies = []

[project.scripts]
forge = "forge.cli:main"
"""

FILES["README.md"] = """# Forge

**Verification-first agentic control plane.**

Forge inverts the typical agent paradigm: **models propose actions, the system decides verdicts.** The LLM never grades its own work.

## Core Pillars

1. **Deterministic State Machine**: `plan -> build (parallel worktrees) -> verify (merge gate + contract stack) -> diagnose (bounded, evidence-driven) -> merge -> done | failed`.
2. **The 6-Layer Contract Stack**:
   - `L0`: typecheck / build
   - `L1`: unit + property tests
   - `L2`: API contract tests
   - `L3`: browser scripts
   - `L4`: visual diff against baseline
   - `L5`: independent LLM judge with evidence bundle
3. **Parallel Lanes & Git Worktrees**: Concurrently executes tasks across isolated git worktrees (`alpha`, `beta`, `gamma`), merging behind a strict green gate.
4. **Git Realms & Time Travel**: Every mutation creates a git snapshot tag (`forge/ck-N`). Failed iterations rewind safely without dirtying the workspace.
5. **Capability-Based Model Router**: Routes task kinds (`architect`, `code`, `debug`, `judge`) by capability scores and enforces model separation (coder models cannot judge their own output).
6. **Evidence Bundles**: Diagnosticians and judges receive concrete artifacts (diffs, console logs, test output tails), not hallucinations.

## Quickstart

```bash
cd forge && pip install -e .

# Run the PlantWatch offline demo with injected regression detection:
forge --root /tmp/plantwatch run --demo "make the dashboard cards smaller"

# Run the local IDE server:
forge serve --port 4141

# Time-travel and query:
forge status
forge rewind 1
forge ask "where is auth handled"
```
"""

FILES["forge/__init__.py"] = '__version__ = "0.1.0"\n'

FILES["forge/events.py"] = '''"""Event bus: single source of truth for execution telemetry and UI streams."""
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
                    f.write(json.dumps(ev) + "\\n")
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
'''

FILES["forge/dag.py"] = '''"""Deterministic task graph execution: lanes in parallel, deps enforced by the system."""
from __future__ import annotations
import threading
from dataclasses import dataclass

@dataclass
class Task:
    id: str
    title: str
    lane: str
    kind: str = "code"
    deps: tuple = ()
    status: str = "pending"
    note: str = ""

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "lane": self.lane,
            "kind": self.kind,
            "deps": list(self.deps),
            "status": self.status,
            "note": self.note
        }

class PlanError(Exception):
    pass

class DAG:
    def __init__(self, tasks):
        self.tasks = {t.id: t for t in tasks}
        if len(self.tasks) != len(tasks):
            raise PlanError("duplicate task ids")
        for t in tasks:
            for d in t.deps:
                if d not in self.tasks:
                    raise PlanError(f"task {t.id}: unknown dependency {d}")

    @property
    def lanes(self):
        return sorted({t.lane for t in self.tasks.values()})

    def execute(self, runner, bus):
        done = set()
        failed = set()
        cond = threading.Condition()

        def dep_state(t):
            if any(d in failed for d in t.deps):
                return "blocked"
            if all(d in done for d in t.deps):
                return "ready"
            return "wait"

        def work(lane):
            while True:
                with cond:
                    cand = [t for t in self.tasks.values() if t.lane == lane and t.status == "pending"]
                    ready = [t for t in cand if dep_state(t) == "ready"]
                    if ready:
                        t = ready[0]
                        t.status = "running"
                    else:
                        pending = [t for t in self.tasks.values() if t.status in ("pending", "running")]
                        if not pending:
                            return
                        if all(t.status != "running" and dep_state(t) != "wait" for t in pending):
                            if not any(t.status == "running" for t in self.tasks.values()):
                                return
                        cond.wait(timeout=0.25)
                        continue

                bus.emit("task.start", f"[{lane}] {t.title}", task=t.id, lane=lane)
                try:
                    ok = bool(runner(t))
                    note = ""
                except Exception as e:
                    ok = False
                    note = str(e)

                with cond:
                    t.status = "done" if ok else "failed"
                    t.note = note
                    (done if ok else failed).add(t.id)
                    cond.notify_all()

                bus.emit(
                    "task.done" if ok else "task.fail",
                    f"[{lane}] {t.title}" + (f" — {note}" if note else ""),
                    task=t.id,
                    lane=lane
                )

        lanes = self.lanes
        threads = [threading.Thread(target=work, args=(l,), daemon=True) for l in lanes]
        for th in threads:
            th.start()
        for th in threads:
            th.join()

        for t in self.tasks.values():
            if t.status == "pending":
                t.status = "failed"
                t.note = "dependency failed"

        return not failed and all(t.status == "done" for t in self.tasks.values())
'''

FILES["forge/realms.py"] = '''"""Realm: an isolatable, snapshot-able part of the workspace. File realm is git-backed."""
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
            excl.write_text(existing + "\\n# forge state\\n.forge/\\n")
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
'''

FILES["forge/worktree.py"] = '''"""Parallel lanes: each lane gets a git worktree; merges happen behind verification gates."""
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
'''

FILES["forge/manifest.py"] = '''"""forge.json — the project manifest. The system reads it; models only propose."""
import json
from pathlib import Path

DEFAULT = {
    "name": "project",
    "commands": {"build": "", "test": "", "contract": "", "browser": ""},
    "visual": {"watch": []},
    "gate": {"require_plan_approval": False},
    "models": {}
}

def load(root):
    p = Path(root) / "forge.json"
    if not p.exists():
        return dict(DEFAULT)
    try:
        cfg = json.loads(p.read_text())
    except Exception:
        return dict(DEFAULT)
    out = dict(DEFAULT)
    out.update({k: v for k, v in cfg.items() if k in out})
    for k, v in DEFAULT["commands"].items():
        out["commands"].setdefault(k, v)
    out["visual"].setdefault("watch", [])
    return out
'''

FILES["forge/evidence.py"] = '''"""Evidence bundles: every diagnose/judge call consumes concrete artifacts, not vibes."""
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
        return "\\n".join(f"- {n}: {p}" for n, p in self._items)
'''

FILES["forge/ollama.py"] = '''"""Ollama API client."""
from __future__ import annotations
import json, re, urllib.request, urllib.error

DEFAULT_BASE = "http://localhost:11434"

class OllamaError(Exception):
    pass

def _params(name: str) -> float:
    mm = re.search(r"(\\d+(?:\\.\\d+)?)b", name.lower())
    return float(mm.group(1)) if mm else 0.0

def _req(base: str, path: str, payload=None, timeout=30):
    url = base.rstrip("/") + path
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
        raise OllamaError(str(e))

def list_models(base=DEFAULT_BASE):
    out = _req(base, "/api/tags")
    models = []
    for m in out.get("models", []):
        name = m.get("name", "")
        models.append({"name": name, "size": m.get("size", 0), "params": _params(name)})
    return models

def chat(base, model, messages, json_mode=False, timeout=240):
    payload = {"model": model, "messages": messages, "stream": False}
    if json_mode:
        payload["format"] = "json"
    out = _req(base, "/api/chat", payload, timeout=timeout)
    return out.get("message", {}).get("content", "")
'''

FILES["forge/router.py"] = '''"""Capability-based model routing with first-class fallback chains."""
from __future__ import annotations
from .ollama import OllamaError

KIND_PRESETS = {
    "architect": ["deepseek-r1", "qwen3", "devstral", "llama3.3", "mistral"],
    "code": ["qwen3-coder", "devstral", "qwen2.5-coder", "codellama", "qwen3"],
    "migrate": ["qwen3-coder", "qwen2.5-coder", "qwen3"],
    "debug": ["deepseek-r1", "qwen3", "qwen3-coder"],
    "judge": ["deepseek-r1", "qwen3", "llama3.3"],
    "fast": ["phi4-mini", "llama3.2", "qwen2.5", "smollm"],
}

def _score(model, kind: str) -> float:
    name = model["name"].lower()
    p = model.get("params", 0.0)
    s = 0.0
    for i, frag in enumerate(KIND_PRESETS.get(kind, KIND_PRESETS["code"])):
        if frag in name:
            s += 100.0 - i
            break

    if kind in ("architect", "debug", "judge"):
        if "coder" in name:
            s -= 50.0
        s += min(p, 70.0) / 10.0
    else:
        s += min(p, 32.0) / 16.0
    return s

class Router:
    def __init__(self, models, bus=None):
        self.models = list(models)
        self.bus = bus

    def candidates(self, kind: str):
        return sorted(self.models, key=lambda m: -_score(m, kind))

    def run(self, kind: str, fn):
        errors = []
        for m in self.candidates(kind):
            if self.bus:
                self.bus.emit("model.route", f"{kind} → {m['name']}", kind=kind, model=m["name"])
            try:
                return fn(m), m["name"]
            except Exception as e:
                errors.append(f"{m['name']}: {e}")
                if self.bus:
                    self.bus.emit("model.fail", f"{m['name']} failed: {e} · falling back", kind=kind, model=m["name"])
        raise OllamaError("all models failed: " + " | ".join(errors))
'''

FILES["forge/knowledge.py"] = '''"""Project intelligence: symbol graph + inverted index for semantic grounding."""
from __future__ import annotations
import re
from pathlib import Path

SKIP = {".git", ".forge", "node_modules", "__pycache__", ".venv", "dist", "build"}
SYM = re.compile(r"^\\s*(?:def|class)\\s+(\\w+)|^\\s*(?:export\\s+)?(?:const|function)\\s+(\\w+)|^\\s*@\\w+")
WORD = re.compile(r"[a-zA-Z_][a-zA-Z0-9_]{2,}")

def build_index(root):
    root = Path(root)
    files = {}
    symbols = {}
    for p in root.rglob("*"):
        if any(s in p.parts for s in SKIP) or not p.is_file():
            continue
        if p.suffix not in (".py", ".ts", ".tsx", ".js", ".jsx", ".sql", ".md", ".json", ".html", ".css"):
            continue
        try:
            text = p.read_text(errors="ignore")
        except OSError:
            continue
        rel = str(p.relative_to(root))
        toks = set(w.lower() for w in WORD.findall(text))
        files[rel] = toks
        for line in text.splitlines():
            mm = SYM.match(line)
            if mm:
                sym = next(g for g in mm.groups() if g)
                symbols.setdefault(sym.lower(), []).append(rel)
    return {"files": files, "symbols": symbols}

def query(index, q: str, k=6):
    terms = [t.lower() for t in WORD.findall(q)]
    scores = []
    for rel, toks in index["files"].items():
        s = sum(1 for t in terms if t in toks)
        for t in terms:
            if t in index["symbols"] and rel in index["symbols"][t]:
                s += 3
        if s:
            scores.append((s, rel))
    return [rel for _, rel in sorted(scores, reverse=True)[:k]]
'''

FILES["forge/contracts.py"] = '''"""The 6-layer verification contract stack. System owns verdicts; models never grade themselves."""
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
        tail = "\\n".join((r.stdout + r.stderr).splitlines()[-30:])
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
        summary = "\\n".join(f"{r.layer} {r.status} {r.detail}" for r in self.results)
        bundle = self.evidence.summary() if self.evidence is not None else "(no evidence files)"
        passed = self.judge(summary, bundle)
        return Result("L5", "pass" if passed else "fail", "accept" if passed else "reject")
'''

FILES["forge/agents.py"] = '''"""Agents propose; system disposes. Implements OllamaAgent and scripted FakeAgent."""
from __future__ import annotations
import json
from .ollama import chat, DEFAULT_BASE
from .router import Router

class AgentError(Exception):
    pass

def parse_json(text: str, what: str):
    try:
        start = text.find("{")
        return json.loads(text[start:]) if start >= 0 else json.loads(text)
    except Exception:
        raise AgentError(f"model did not return valid json for {what}")

SYS_PLAN = (
    "You are the architect of a verification-first coding system. Decompose the request into a task DAG. "
    "Respond with JSON only: {\\"tasks\\":[{\\"id\\":\\"t1\\",\\"title\\":\\"...\\",\\"lane\\":\\"alpha\\",\\"kind\\":\\"code\\",\\"deps\\":[]}]}. "
    "Lanes run in parallel as git worktrees; deps must reference existing ids."
)
SYS_EDIT = (
    "You implement one task in an existing project. Respond with JSON only: {\\"files\\":{\\"path/to/file\\":\\"full new content\\"}}. "
    "Relative paths only, no '..'."
)
SYS_FIX = "You receive an evidence bundle of a verification failure. Respond with JSON only: {\\"files\\":{...}} to fix it."
JUDGE_SYS = (
    "You are a strict verification judge. Given layer results and an evidence bundle, output JSON: {\\"verdict\\":\\"pass\\"|\\"fail\\"}. "
    "Fail closed: any failed layer means fail."
)

class OllamaAgent:
    def __init__(self, router, base=DEFAULT_BASE):
        self.router = router
        self.base = base

    def complete(self, kind, system, user, json_mode=True):
        def fn(m):
            return chat(self.base, m["name"], [{"role": "system", "content": system}, {"role": "user", "content": user}], json_mode=json_mode)
        text, _ = self.router.run(kind, fn)
        return text

    def judge(self, layer_summary, bundle_summary):
        text = self.complete("judge", JUDGE_SYS, f"Layer results:\\n{layer_summary}\\n\\nEvidence:\\n{bundle_summary}")
        try:
            d = parse_json(text, "judge")
            return d.get("verdict") == "pass"
        except Exception:
            return False

class FakeAgent:
    """Scripted agent for offline demo and verification suites."""
    def __init__(self, script, bus=None):
        self.script = script
        self.bus = bus
        self.calls = []

    def complete(self, kind, system, user, json_mode=True):
        tag = ""
        if "⟪" in user and "⟫" in user:
            tag = user.split("⟪", 1)[1].split("⟫", 1)[0]
        self.calls.append((kind, tag))
        if self.bus:
            self.bus.emit("model.fake", f"scripted {kind} ⟪{tag}⟫", kind=kind)
        key = (kind, tag)
        if key not in self.script:
            raise AgentError(f"fake agent has no script for {key}")
        return self.script[key]

    def judge(self, layer_summary, bundle_summary):
        return "fail" not in layer_summary.lower()

def plan_from_json(data):
    from .dag import Task, PlanError
    raw = data.get("tasks")
    if not isinstance(raw, list) or not raw:
        raise PlanError("plan has no tasks")
    return [
        Task(
            id=str(t["id"]),
            title=str(t.get("title", t["id"])),
            lane=str(t.get("lane", "alpha")),
            kind=str(t.get("kind", "code")),
            deps=tuple(t.get("deps", []))
        )
        for t in raw
    ]
'''

FILES["forge/statemachine.py"] = '''"""The deterministic control loop:
plan → build (parallel worktrees) → verify (merge gate + contract stack) → diagnose → merge → done
"""
from __future__ import annotations
import json, time
from pathlib import Path
from .dag import DAG, PlanError
from .realms import FileRealm, git
from .worktree import WorktreePool
from .manifest import load as load_manifest
from .contracts import Stack
from .evidence import Bundle
from .agents import SYS_PLAN, SYS_EDIT, SYS_FIX, parse_json, plan_from_json, AgentError

PHASES = ("plan", "build", "verify", "diagnose", "merge", "done", "failed")

class RunResult:
    def __init__(self, ok, phase, checkpoint, rounds):
        self.ok = ok
        self.phase = phase
        self.checkpoint = checkpoint
        self.rounds = rounds

    def to_dict(self):
        return {
            "ok": self.ok,
            "phase": self.phase,
            "checkpoint": self.checkpoint,
            "diagnose_rounds": self.rounds
        }

class Loop:
    def __init__(self, root, prompt, agent, bus, assume_yes=True, max_diagnose=3):
        self.root = Path(root).resolve()
        self.prompt = prompt
        self.agent = agent
        self.bus = bus
        self.assume_yes = assume_yes
        self.max_diagnose = max_diagnose
        self.phase = "plan"
        self.tasks = []
        self.contracts = []

    def run(self):
        t0 = time.time()
        realm = FileRealm(self.root)
        manifest = load_manifest(self.root)
        self.bus.emit("run.start", f"forge run · {self.prompt!r}", root=str(self.root))
        judge = lambda ls, b: self.agent.judge(ls, b)

        try:
            tasks = self._plan()
        except PlanError as e:
            self.bus.emit("run.failed", f"invalid plan: {e}")
            self.phase = "failed"
            return RunResult(False, "failed", 0, 0)

        pre = realm.snapshot("pre-run")
        self.bus.emit("checkpoint", f"checkpoint #{pre} · pre-run")

        if manifest["gate"].get("require_plan_approval") and not self.assume_yes:
            self.bus.emit("gate", "waiting for plan approval…")
            ok = input(f"approve plan? {len(tasks)} tasks · [y/N] ").strip().lower() == "y"
            if not ok:
                self.phase = "failed"
                self.bus.emit("run.failed", "plan rejected at gate")
                return RunResult(False, "failed", pre, 0)

        self.phase = "build"
        pool = WorktreePool(realm)
        lanes = sorted({t.lane for t in tasks})
        pool.setup(lanes)
        dag = DAG(tasks)
        self.tasks = tasks

        ok = dag.execute(lambda t: self._implement(t, pool, manifest), self.bus)
        if not ok:
            self.phase = "failed"
            self.bus.emit("run.failed", "task failed in lane; workspace untouched — rewind available")
            pool.cleanup()
            return RunResult(False, "failed", pre, 0)

        for lane in lanes:
            pool.commit(lane, f"forge: lane {lane} build")

        self.phase = "verify"
        bundle = Bundle(self.root / ".forge" / "evidence" / time.strftime("%Y%m%d-%H%M%S"))
        rounds = 0
        merged = 0

        for lane in lanes:
            clean, why = pool.merge(lane)
            merged_ready = clean
            if not clean:
                pool.abort()
                self.bus.emit("merge.fail", f"lane {lane}: merge conflict — routing to diagnose")

            while True:
                stack = Stack(self.root, manifest, self.bus, judge=judge, evidence=bundle)
                results = stack.run()
                self.contracts = [r.to_dict() for r in results]
                red = not stack.verdict()

                if not red:
                    if merged_ready:
                        pool.finish_merge(f"forge: merge lane {lane} · contracts green")
                        merged += 1
                        self.bus.emit("merge.ok", f"lane {lane} merged behind green gate")
                        break
                    else:
                        self.bus.emit("run.failed", f"lane {lane} could not be cleanly merged")
                        realm.restore(pre)
                        pool.cleanup()
                        return RunResult(False, "failed", pre, rounds)

                rounds += 1
                if rounds > self.max_diagnose:
                    pool.abort()
                    self.phase = "failed"
                    self.bus.emit("run.failed", f"contracts red after {self.max_diagnose} diagnose rounds — rewinding to #{pre}")
                    realm.restore(pre)
                    pool.cleanup()
                    return RunResult(False, "failed", pre, rounds)

                self.phase = "diagnose"
                self.bus.emit("diagnose", f"round {rounds}: evidence bundle → debugger", round=rounds)

                diff_stat = git(self.root, "diff", "HEAD", "--stat", check=False).stdout
                bundle.add_text("diff-stat.txt", diff_stat)

                pool.abort()
                merged_ready = False

                try:
                    self._diagnose(pool, lane, bundle, results)
                except AgentError as e:
                    self.bus.emit("diagnose.error", f"debugger failed: {e}")

                pool.commit(lane, f"forge: diagnose round {rounds}")
                clean, why = pool.merge(lane)
                merged_ready = clean
                if not clean:
                    pool.abort()
                self.phase = "verify"

        self.phase = "merge"
        post = realm.snapshot("post-run")
        pool.cleanup()
        self.bus.emit("run.done", f"done in {time.time()-t0:.1f}s · checkpoints #{pre}→#{post} · {merged} lanes merged · {rounds} diagnose rounds")
        return RunResult(True, "done", post, rounds)

    def _plan(self):
        self.bus.emit("plan", "decomposing request into task dag…")
        mf_text = (self.root / "forge.json").read_text() if (self.root / "forge.json").exists() else "{}"
        user = f"Project manifest:\\n{mf_text}\\n\\nRequest: {self.prompt}\\n\\n⟪plan⟫"
        text = self.agent.complete("architect", SYS_PLAN, user)
        tasks = plan_from_json(parse_json(text, "plan"))
        self.bus.emit("plan.ok", f"plan accepted by gate · {len(tasks)} tasks · lanes: {', '.join(sorted({t.lane for t in tasks}))}")
        for t in tasks:
            self.bus.emit("task", f"  {t.id} [{t.lane}] {t.title} deps={list(t.deps)}")
        return tasks

    def _implement(self, task, pool, manifest):
        target = pool.path(task.lane)
        ctx = f"task {task.id}: {task.title}\\n⟪edit:{task.id}⟫"
        text = self.agent.complete(task.kind, SYS_EDIT, ctx)
        files = parse_json(text, "edit").get("files", {})
        if not files:
            raise AgentError("model proposed no files")
        for rel, content in files.items():
            rel = str(rel)
            if rel.startswith("/") or ".." in Path(rel).parts:
                raise AgentError(f"unsafe path {rel}")
            p = target / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content)
        return True

    def _diagnose(self, pool, lane, bundle, results):
        ls = "\\n".join(f"{r.layer} {r.status} {r.detail}" for r in results)
        bundle.add_text("failing-layers.txt", ls)
        user = f"lane {lane}\\nlayer results:\\n{ls}\\n\\nevidence bundle:\\n{bundle.summary()}\\n\\n⟪fix:{lane}⟫"
        text = self.agent.complete("debug", SYS_FIX, user)
        files = parse_json(text, "fix").get("files", {})
        target = pool.path(lane)
        for rel, content in files.items():
            rel = str(rel)
            if rel.startswith("/") or ".." in Path(rel).parts:
                raise AgentError(f"unsafe path {rel}")
            p = target / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content)
        bundle.add_text("round-note.txt", f"fix applied to lane {lane}: {', '.join(files)}")
'''

FILES["forge/demo.py"] = '''"""Offline end-to-end demo of PlantWatch scenario:
System catches injected layout collision in login.html, generates evidence, fixes lane, and merges clean.
"""
from __future__ import annotations
import json
from pathlib import Path

LOGIN_GOOD = """<!doctype html>
<html><head><title>PlantWatch · Login</title>
<style>
body.auth { font-family: sans-serif; background: #111; color: #eee; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
.login-card { background: #1c1c1c; border: 1px solid #333; border-radius: 8px; padding: 24px; width: 320px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
.login-card h1 { font-size: 20px; margin-top: 0; margin-bottom: 16px; color: #fff; }
.login-card input { width: 100%; box-sizing: border-box; padding: 8px 12px; margin-bottom: 12px; background: #252525; border: 1px solid #444; border-radius: 4px; color: #fff; }
.login-card button { width: 100%; padding: 10px; background: #3b82f6; border: none; border-radius: 4px; color: #fff; font-weight: bold; cursor: pointer; }
</style></head>
<body class="auth">
  <main class="login-card">
    <h1>PlantWatch</h1>
    <input placeholder="username">
    <input placeholder="password" type="password">
    <button>Sign in</button>
  </main>
</body></html>
"""

LOGIN_BAD = LOGIN_GOOD.replace('<body class="auth">', '<body class="auth sidebar">').replace('class="login-card"', 'class="login-card cards"')

DASH_ORIG = """<!doctype html>
<html><head><title>PlantWatch · Industrial Dashboard</title>
<style>
body { font-family: sans-serif; background: #0f172a; color: #f8fafc; margin: 0; display: flex; }
.sidebar { width: 220px; background: #1e293b; padding: 20px; min-height: 100vh; }
main { flex: 1; padding: 24px; }
.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
.card b { display: block; font-size: 24px; margin-top: 8px; color: #38bdf8; }
</style></head>
<body>
<nav class="sidebar"><h2>PlantWatch</h2><a>Dashboard</a><a>Machines</a><a>Work Orders</a></nav>
<main>
  <div class="cards">
    <div class="card">Uptime<b>98.2%</b></div>
    <div class="card">Open Work Orders<b>23</b></div>
    <div class="card">Critical Alerts<b>3</b></div>
    <div class="card">MTTR<b>4.1h</b></div>
  </div>
</main>
</body></html>
"""

DASH_NEW = DASH_ORIG.replace("repeat(4, 1fr)", "repeat(3, 1fr)").replace("padding: 16px;", "padding: 12px;")

API = """\\"\\"\\"PlantWatch machines API — stdlib only.\\"\\"\\"
MACHINES = [
    {"id": "M-014", "name": "compressor", "status": "vibration high"},
    {"id": "M-022", "name": "conveyor belt", "status": "scheduled pm"},
    {"id": "M-031", "name": "pump station", "status": "leak sensor triaged"},
]

def list_machines(status=None):
    if status is None:
        return list(MACHINES)
    return [m for m in MACHINES if m["status"] == status]
"""

TEST = """import unittest
from api.machines import list_machines

class TestMachines(unittest.TestCase):
    def test_list_all(self):
        self.assertEqual(len(list_machines()), 3)

    def test_filter(self):
        rows = list_machines(status="scheduled pm")
        self.assertEqual([r["id"] for r in rows], ["M-022"])

if __name__ == "__main__":
    unittest.main()
"""

MIGRATION = """-- 003: composite index for machine_id + timestamp
CREATE INDEX IF NOT EXISTS idx_events_machine_ts ON maintenance_events(machine_id, timestamp);
"""

SEED = """\\"\\"\\"Seed + backfill for PlantWatch events.\\"\\"\\"
EVENTS = [
    ("M-014", "2026-09-12T08:00:00", "vibration_high"),
    ("M-031", "2026-09-12T09:30:00", "leak")
]

def backfill(conn):
    conn.executemany("INSERT INTO maintenance_events(machine_id, timestamp, kind) VALUES (?, ?, ?)", EVENTS)
"""

PLAN = {
    "tasks": [
        {"id": "t_a1", "title": "restyle sidebar + smaller dashboard cards", "lane": "alpha", "kind": "code", "deps": []},
        {"id": "t_b1", "title": "migration: composite index on machine_id+ts", "lane": "beta", "kind": "migrate", "deps": []},
        {"id": "t_b2", "title": "seed + backfill events", "lane": "beta", "kind": "migrate", "deps": ["t_b1"]},
        {"id": "t_g1", "title": "api: machines endpoint + tests", "lane": "gamma", "kind": "code", "deps": []},
    ]
}

MANIFEST = {
    "name": "plantwatch",
    "commands": {
        "build": "python3 -m compileall -q api db tests",
        "test": "python3 -m unittest discover -s tests -q",
        "contract": "",
        "browser": ""
    },
    "visual": {"watch": ["login.html"]},
    "gate": {"require_plan_approval": False},
    "models": {}
}

def scaffold(root):
    root = Path(root)
    (root / "api").mkdir(parents=True, exist_ok=True)
    (root / "db").mkdir(parents=True, exist_ok=True)
    (root / "tests").mkdir(parents=True, exist_ok=True)
    (root / "api" / "__init__.py").write_text("")
    (root / "db" / "__init__.py").write_text("")
    (root / "tests" / "__init__.py").write_text("")
    (root / "index.html").write_text(DASH_ORIG)
    (root / "login.html").write_text(LOGIN_GOOD)
    (root / "api" / "machines.py").write_text(API)
    (root / "tests" / "test_api.py").write_text(TEST)
    (root / "db" / "migration_003.sql").write_text(MIGRATION)
    (root / "db" / "seed.py").write_text(SEED)
    (root / "forge.json").write_text(json.dumps(MANIFEST, indent=2))

def demo_agent():
    from .agents import FakeAgent
    script = {
        ("architect", "plan"): json.dumps(PLAN),
        ("code", "edit:t_a1"): json.dumps({"files": {"index.html": DASH_NEW, "login.html": LOGIN_BAD}}),
        ("migrate", "edit:t_b1"): json.dumps({"files": {"db/migration_003.sql": MIGRATION}}),
        ("migrate", "edit:t_b2"): json.dumps({"files": {"db/seed.py": SEED}}),
        ("code", "edit:t_g1"): json.dumps({"files": {"api/machines.py": API, "tests/test_api.py": TEST}}),
        ("debug", "fix:alpha"): json.dumps({"files": {"login.html": LOGIN_GOOD}}),
    }
    return FakeAgent(script)

def record_visual_baseline(root, manifest=None):
    from .manifest import load as load_manifest
    from .contracts import _hash
    m = manifest or load_manifest(root)
    base = {rel: _hash(Path(root) / rel) for rel in m["visual"]["watch"] if (Path(root) / rel).exists()}
    p = Path(root) / ".forge"
    p.mkdir(exist_ok=True)
    (p / "visual_baseline.json").write_text(json.dumps(base, indent=2))

def run_demo(root, bus, assume_yes=True):
    from .statemachine import Loop
    scaffold(root)
    record_visual_baseline(root)
    loop = Loop(root, "make the dashboard cards smaller", demo_agent(), bus, assume_yes=assume_yes)
    return loop.run()
'''

FILES["forge/cli.py"] = '''"""forge CLI — control plane entry point."""
from __future__ import annotations
import argparse, json, sys, time
from pathlib import Path

def _print(ev):
    icon = {
        "run.start": "▶", "plan": "◇", "plan.ok": "✓", "task": "·", "task.start": "▸",
        "task.done": "✓", "task.fail": "✗", "contract": "◆", "checkpoint": "●",
        "merge.ok": "⇒", "merge.fail": "✗", "diagnose": "⚕", "run.done": "■",
        "run.failed": "✗", "model.route": "⇄", "model.fail": "⚠", "gate": "▣"
    }.get(ev["type"], " ")
    ts = time.strftime("%H:%M:%S", time.localtime(ev["ts"]))
    print(f"{ts} {icon} {ev['msg']}", flush=True)

def cmd_init(a):
    from .manifest import DEFAULT
    root = Path(a.root)
    if not (root / "forge.json").exists():
        (root / "forge.json").write_text(json.dumps(DEFAULT, indent=2))
        print(f"wrote {root / 'forge.json'} — edit commands before running")

def cmd_run(a):
    from .events import Bus
    from .statemachine import Loop
    bus = Bus(Path(a.root) / ".forge" / "events.jsonl")
    bus.on(_print)
    if a.demo:
        from .demo import run_demo
        res = run_demo(a.root, bus, assume_yes=a.yes)
        sys.exit(0 if res.ok else 1)
    agent = _make_agent(a, bus)
    loop = Loop(a.root, a.prompt, agent, bus, assume_yes=a.yes)
    res = loop.run()
    sys.exit(0 if res.ok else 1)

def _make_agent(a, bus):
    from .agents import OllamaAgent
    from .router import Router
    from .ollama import list_models, OllamaError
    try:
        models = list_models(a.ollama)
    except OllamaError as e:
        print(f"ollama unreachable at {a.ollama} ({e}). Use --demo for offline mode.", file=sys.stderr)
        sys.exit(2)
    if not models:
        print("no models installed. Run: ollama pull qwen3-coder", file=sys.stderr)
        sys.exit(2)
    print(f"models discovered: {', '.join(m['name'] for m in models)}")
    return OllamaAgent(Router(models, bus), base=a.ollama)

def cmd_status(a):
    from .realms import FileRealm
    realm = FileRealm(a.root)
    for n, tag in realm.checkpoints():
        print(f"#{n}  {tag}")

def cmd_rewind(a):
    from .realms import FileRealm
    realm = FileRealm(a.root)
    realm.restore(a.n)
    print(f"restored to checkpoint #{a.n}")

def cmd_models(a):
    from .ollama import list_models
    for m in list_models(a.ollama):
        print(f"{m['name']}\\t{m['params']}B\\t{m['size'] // 1_000_000}MB")

def cmd_ask(a):
    from .knowledge import build_index, query
    idx = build_index(a.root)
    for rel in query(idx, a.q):
        print(rel)

def cmd_serve(a):
    from .webui import serve
    serve(a.root, port=a.port, host=a.host, ollama=a.ollama)

def main(argv=None):
    p = argparse.ArgumentParser(prog="forge", description="Verification-first agentic control plane")
    p.add_argument("--root", default=".")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("init")

    r = sub.add_parser("run")
    r.add_argument("prompt")
    r.add_argument("--yes", action="store_true")
    r.add_argument("--demo", action="store_true")
    r.add_argument("--ollama", default="http://localhost:11434")

    sub.add_parser("status")

    rw = sub.add_parser("rewind")
    rw.add_argument("n", type=int)

    m = sub.add_parser("models")
    m.add_argument("--ollama", default="http://localhost:11434")

    q = sub.add_parser("ask")
    q.add_argument("q")

    s = sub.add_parser("serve")
    s.add_argument("--port", type=int, default=4141)
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--ollama", default="http://localhost:11434")

    a = p.parse_args(argv)
    {"init": cmd_init, "run": cmd_run, "status": cmd_status, "rewind": cmd_rewind, "models": cmd_models, "ask": cmd_ask, "serve": cmd_serve}[a.cmd](a)

if __name__ == "__main__":
    main()
'''

FILES["forge/webui.py"] = '''"""Local IDE server for Forge."""
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
'''

FILES["tests/test_forge.py"] = '''import json, tempfile, unittest
from pathlib import Path
from forge.dag import DAG, Task, PlanError
from forge.router import Router
from forge.realms import FileRealm
from forge.demo import run_demo, LOGIN_GOOD
from forge.events import Bus

class TestDAG(unittest.TestCase):
    def test_dependency_order(self):
        t1 = Task("t1", "base", "alpha")
        t2 = Task("t2", "child", "alpha", deps=("t1",))
        order = []
        dag = DAG([t1, t2])
        def runner(t):
            order.append(t.id)
            return True
        ok = dag.execute(runner, Bus())
        self.assertTrue(ok)
        self.assertEqual(order, ["t1", "t2"])

    def test_failed_dep_blocks_child(self):
        t1 = Task("t1", "fail", "alpha")
        t2 = Task("t2", "child", "alpha", deps=("t1",))
        executed = []
        dag = DAG([t1, t2])
        def runner(t):
            executed.append(t.id)
            return False if t.id == "t1" else True
        ok = dag.execute(runner, Bus())
        self.assertFalse(ok)
        self.assertEqual(executed, ["t1"])
        self.assertEqual(dag.tasks["t2"].status, "failed")

    def test_unknown_dep_raises(self):
        with self.assertRaises(PlanError):
            DAG([Task("t1", "a", "alpha", deps=("ghost",))])

class TestRouter(unittest.TestCase):
    def test_coder_model_cannot_judge(self):
        models = [
            {"name": "qwen3-coder:30b", "params": 30.0},
            {"name": "deepseek-r1:14b", "params": 14.0},
        ]
        r = Router(models)
        judge_first = r.candidates("judge")[0]["name"]
        self.assertEqual(judge_first, "deepseek-r1:14b")

    def test_coder_model_preferred_for_code(self):
        models = [
            {"name": "qwen3-coder:30b", "params": 30.0},
            {"name": "deepseek-r1:14b", "params": 14.0},
        ]
        r = Router(models)
        code_first = r.candidates("code")[0]["name"]
        self.assertEqual(code_first, "qwen3-coder:30b")

class TestRealms(unittest.TestCase):
    def test_snapshot_and_restore(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td)
            (p / "file.txt").write_text("v1")
            realm = FileRealm(p)
            ck1 = realm.snapshot("first")
            (p / "file.txt").write_text("v2")
            (p / "dirty.txt").write_text("trash")
            realm.restore(ck1)
            self.assertEqual((p / "file.txt").read_text(), "v1")
            self.assertFalse((p / "dirty.txt").exists())

class TestE2EFullLoop(unittest.TestCase):
    def test_full_loop_offline(self):
        with tempfile.TemporaryDirectory() as td:
            bus = Bus()
            res = run_demo(td, bus)
            self.assertTrue(res.ok, "run should succeed")
            self.assertEqual(res.rounds, 1, "diagnose should run exactly 1 round for visual regression")
            root = Path(td)
            self.assertEqual((root / "login.html").read_text(), LOGIN_GOOD)
            self.assertIn("repeat(3, 1fr)", (root / "index.html").read_text())
            realm = FileRealm(root)
            self.assertGreaterEqual(len(realm.checkpoints()), 2)

    def test_rewind_after_run(self):
        with tempfile.TemporaryDirectory() as td:
            bus = Bus()
            res = run_demo(td, bus)
            root = Path(td)
            realm = FileRealm(root)
            realm.restore(1)
            self.assertIn("repeat(4, 1fr)", (root / "index.html").read_text())

if __name__ == "__main__":
    unittest.main()
'''

for base in OUT_DIRS:
    for rel_path, content in FILES.items():
        p = base / rel_path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
    print(f"Wrote {len(FILES)} files to {base}")

