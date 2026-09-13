import { Task, ContractResult, ModelInfo, EvidenceFile, KnowledgeSymbol } from '../types';

export const INITIAL_TASKS: Task[] = [
  {
    id: 't_a1',
    title: 'restyle sidebar + smaller dashboard cards',
    lane: 'alpha',
    kind: 'code',
    deps: [],
    status: 'pending',
    worktreePath: '.forge/wt/alpha',
    files: ['index.html', 'login.html (regression)'],
  },
  {
    id: 't_b1',
    title: 'migration: composite index on machine_id+ts',
    lane: 'beta',
    kind: 'migrate',
    deps: [],
    status: 'pending',
    worktreePath: '.forge/wt/beta',
    files: ['db/migration_003.sql'],
  },
  {
    id: 't_b2',
    title: 'seed + backfill events data',
    lane: 'beta',
    kind: 'migrate',
    deps: ['t_b1'],
    status: 'pending',
    worktreePath: '.forge/wt/beta',
    files: ['db/seed.py'],
  },
  {
    id: 't_g1',
    title: 'api: machines endpoint + unit tests',
    lane: 'gamma',
    kind: 'code',
    deps: [],
    status: 'pending',
    worktreePath: '.forge/wt/gamma',
    files: ['api/machines.py', 'tests/test_api.py'],
  },
];

export const INITIAL_CONTRACTS: ContractResult[] = [
  {
    layer: 'L0',
    name: 'typecheck/build',
    status: 'pending',
    detail: 'python3 -m compileall -q api db tests',
    command: 'python3 -m compileall -q api db tests',
  },
  {
    layer: 'L1',
    name: 'unit + property',
    status: 'pending',
    detail: 'python3 -m unittest discover -s tests -q',
    command: 'python3 -m unittest discover -s tests -q',
  },
  {
    layer: 'L2',
    name: 'api contract',
    status: 'pending',
    detail: 'api.machines.list_machines() spec schema',
    command: 'forge verify-contract --layer L2',
  },
  {
    layer: 'L3',
    name: 'browser script',
    status: 'pending',
    detail: 'Playwright headless DOM interaction',
    command: 'playwright test --reporter=json',
  },
  {
    layer: 'L4',
    name: 'visual diff',
    status: 'pending',
    detail: 'baseline hash watch on ["login.html"]',
    command: 'forge visual-diff --watch login.html',
  },
  {
    layer: 'L5',
    name: 'judge + evidence',
    status: 'pending',
    detail: 'fail-closed verdict by independent model',
    command: 'forge judge --model deepseek-r1:14b',
  },
];

export const MODEL_REGISTRY: ModelInfo[] = [
  {
    name: 'qwen3-coder:30b',
    params: 30.0,
    sizeMB: 18400,
    primaryClass: 'Code Specialist',
    capabilities: {
      architect: 65,
      code: 98,
      migrate: 94,
      debug: 82,
      judge: 20, // penalized -50 because coder model cannot judge
      fast: 70,
    },
    isCoder: true,
  },
  {
    name: 'deepseek-r1:14b',
    params: 14.0,
    sizeMB: 9200,
    primaryClass: 'Reasoning & Architecture',
    capabilities: {
      architect: 96,
      code: 80,
      migrate: 75,
      debug: 94,
      judge: 98,
      fast: 60,
    },
    isCoder: false,
  },
  {
    name: 'llama3.3:70b',
    params: 70.0,
    sizeMB: 43000,
    primaryClass: 'Heavyweight Fallback',
    capabilities: {
      architect: 92,
      code: 88,
      migrate: 85,
      debug: 90,
      judge: 92,
      fast: 40,
    },
    isCoder: false,
  },
  {
    name: 'phi4-mini:3.8b',
    params: 3.8,
    sizeMB: 2400,
    primaryClass: 'Fast Sub-Agent Probe',
    capabilities: {
      architect: 45,
      code: 65,
      migrate: 60,
      debug: 55,
      judge: 35,
      fast: 96,
    },
    isCoder: false,
  },
];

export const INITIAL_EVIDENCE: EvidenceFile[] = [
  {
    name: 'failing-layers.txt',
    path: '.forge/evidence/20260913-0655/failing-layers.txt',
    description: 'Contract stack diagnostic failure log at L4 verification gate',
    type: 'text',
    content: `L0 pass — ok
L1 pass — ok
L2 pass — ok
L3 pass — ok
L4 fail — unexpected change: login.html
L5 fail — reject (judge saw failed layer L4: fail-closed verdict)

Artifact breakdown:
- login.html SHA-256 hash mismatch
  expected: a4f8e91d03b912c7... (baseline v13)
  received: e93bc0192a83f144... (worktree alpha commit)
- Scope leak detected: Task t_a1 restyled sidebar in index.html but accidentally injected ".sidebar .cards" class into login.html`,
  },
  {
    name: 'diff-stat.txt',
    path: '.forge/evidence/20260913-0655/diff-stat.txt',
    description: 'Git diff stat of staged merge before abort & diagnose loop',
    type: 'diff',
    content: ` index.html | 14 +++++++-------
 login.html |  4 ++--
 2 files changed, 9 insertions(+), 9 deletions(-)

--- a/login.html
+++ b/login.html
@@ -7,4 +7,4 @@
-<body class="auth">
-  <main class="login-card">
+<body class="auth sidebar">
+  <main class="login-card cards">
     <h1>PlantWatch</h1>`,
  },
  {
    name: 'round-note.txt',
    path: '.forge/evidence/20260913-0655/round-note.txt',
    description: 'Autonomous debugger fix record applied directly to worktree alpha',
    type: 'text',
    content: `Fix applied to lane alpha: login.html
Debugger model: deepseek-r1:14b
Action: Restored login.html to scoped baseline definition (removed leaked "sidebar" and "cards" classnames).
Worktree alpha re-committed with message: 'forge: diagnose round 1'
Re-attempting merge behind contract stack gate.`,
  },
  {
    name: 'visual_baseline.json',
    path: '.forge/visual_baseline.json',
    description: 'Recorded baseline snapshot hashes for watched critical paths',
    type: 'json',
    content: `{
  "login.html": "a4f8e91d03b912c7",
  "watch_policy": "strict_equality",
  "timestamp": "2026-09-13T06:55:00Z",
  "checkpoint": 1
}`,
  },
];

export const KNOWLEDGE_SYMBOLS: KnowledgeSymbol[] = [
  {
    name: 'list_machines',
    kind: 'function',
    file: 'api/machines.py',
    line: 9,
    description: 'Returns list of industrial plant machines filtered optionally by status (scheduled pm, vibration high, leak).',
  },
  {
    name: 'idx_events_machine_ts',
    kind: 'table',
    file: 'db/migration_003.sql',
    line: 2,
    description: 'Composite database index on maintenance_events(machine_id, timestamp) for rapid query performance.',
  },
  {
    name: 'backfill',
    kind: 'function',
    file: 'db/seed.py',
    line: 5,
    description: 'Seed script inserting simulated telemetry alerts for compressors and pump stations.',
  },
  {
    name: 'auth_login_card',
    kind: 'style',
    file: 'login.html',
    line: 6,
    description: 'Centered card layout for PlantWatch credentials and session token dispatch.',
  },
  {
    name: 'dashboard_cards_grid',
    kind: 'style',
    file: 'index.html',
    line: 5,
    description: 'Responsive CSS Grid defining telemetry metrics: Uptime, Open Work Orders, Critical Alerts, MTTR.',
  },
  {
    name: 'TestMachines',
    kind: 'class',
    file: 'tests/test_api.py',
    line: 4,
    description: 'Unit tests asserting machines API returns expected record count and filter capabilities.',
  },
];

export const FORGE_SOURCE_FILES: Record<string, { desc: string; code: string; lang: string }> = {
  'forge/statemachine.py': {
    desc: 'Deterministic control loop: plan -> build (worktrees) -> verify (contracts) -> diagnose -> merge',
    lang: 'python',
    code: `"""The deterministic control loop:
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

class Loop:
    def __init__(self, root, prompt, agent, bus, assume_yes=True, max_diagnose=3):
        self.root = Path(root).resolve()
        self.prompt = prompt
        self.agent = agent
        self.bus = bus
        self.max_diagnose = max_diagnose

    def run(self):
        realm = FileRealm(self.root)
        manifest = load_manifest(self.root)
        tasks = self._plan()
        pre = realm.snapshot("pre-run") # Checkpoint #1

        pool = WorktreePool(realm)
        lanes = sorted({t.lane for t in tasks})
        pool.setup(lanes)

        # Parallel worktree execution
        dag = DAG(tasks)
        dag.execute(lambda t: self._implement(t, pool, manifest), self.bus)

        for lane in lanes:
            pool.commit(lane, f"forge: lane {lane} build")

        # Merge Gate & Contract Stack
        for lane in lanes:
            clean, why = pool.merge(lane)
            while True:
                stack = Stack(self.root, manifest, self.bus, judge=self.agent.judge)
                results = stack.run()
                if stack.verdict():
                    pool.finish_merge(f"forge: merge lane {lane} · green")
                    break
                # RED -> Autonomous Diagnose with Evidence Bundle
                pool.abort()
                self._diagnose(pool, lane, bundle, results)
                pool.commit(lane, "forge: diagnose fix")
                pool.merge(lane) # Re-attempt merge

        post = realm.snapshot("post-run") # Checkpoint #2
        pool.cleanup()
        return RunResult(True, "done", post, rounds)`,
  },
  'forge/contracts.py': {
    desc: 'The 6-layer contract stack: build, tests, API, browser, visual diff, model judge',
    lang: 'python',
    code: `"""The 6-layer verification contract stack. System owns verdicts; models never grade themselves."""
LAYERS = ("L0", "L1", "L2", "L3", "L4", "L5")
NAMES = {
    "L0": "typecheck/build",
    "L1": "unit + property",
    "L2": "api contract",
    "L3": "browser script",
    "L4": "visual diff",
    "L5": "judge + evidence"
}

class Stack:
    def _l4(self):
        watch = self.m["visual"].get("watch", [])
        baseline = json.loads((self.root / ".forge/visual_baseline.json").read_text())
        changed = []
        for rel in watch:
            p = self.root / rel
            if baseline.get(rel) != _hash(p):
                changed.append(rel)
        if changed:
            return Result("L4", "fail", f"unexpected change: {', '.join(changed)}")
        return Result("L4", "pass", "100.0% scoped match")

    def _l5(self):
        # Independent model evaluation; fail-closed
        summary = "\\n".join(f"{r.layer} {r.status} {r.detail}" for r in self.results)
        passed = self.judge(summary, self.evidence.summary())
        return Result("L5", "pass" if passed else "fail", "accept" if passed else "reject")`,
  },
  'forge/realms.py': {
    desc: 'Git-backed filesystem realm: snapshot tags and non-destructive rewinds',
    lang: 'python',
    code: `"""Filesystem realm: snapshot = tag, restore = reset+clean. .forge/ is never committed."""
class FileRealm:
    def snapshot(self, label=""):
        self._state["checkpoint"] += 1
        n = self._state["checkpoint"]
        git(self.root, "add", "-A")
        git(self.root, "commit", "--allow-empty", "-m", f"forge checkpoint #{n} {label}")
        git(self.root, "tag", "-f", f"forge/ck-{n}")
        return n

    def restore(self, n):
        git(self.root, "reset", "--hard", f"forge/ck-{n}")
        git(self.root, "clean", "-fd", "--exclude=.forge/")`,
  },
  'forge/router.py': {
    desc: 'Capability-based model routing with coder/judge separation and fallback chains',
    lang: 'python',
    code: `def _score(model, kind: str) -> float:
    name = model["name"].lower()
    # Principle: coder model cannot judge its own work
    if kind in ("architect", "debug", "judge"):
        if "coder" in name:
            s -= 50.0  # Penalized!
        s += min(p, 70.0) / 10.0
    return s`,
  },
};

export const PLANTWATCH_FILES: Record<string, { desc: string; code: string; lang: string }> = {
  'index.html': {
    desc: 'PlantWatch primary dashboard with 4 cards (Baseline) or 3 smaller cards (Goal)',
    lang: 'html',
    code: `<!doctype html>
<html><head><title>PlantWatch · Industrial Dashboard</title>
<style>
body { font-family: sans-serif; background: #0f172a; color: #f8fafc; margin: 0; display: flex; }
.sidebar { width: 220px; background: #1e293b; padding: 20px; min-height: 100vh; }
main { flex: 1; padding: 24px; }
.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
.card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px; }
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
</body></html>`,
  },
  'login.html': {
    desc: 'PlantWatch login screen — critical watched file for visual regression',
    lang: 'html',
    code: `<!doctype html>
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
</body></html>`,
  },
  'api/machines.py': {
    desc: 'Industrial machine status API endpoint with vibration and leak detection',
    lang: 'python',
    code: `"""PlantWatch machines API — stdlib only."""
MACHINES = [
    {"id": "M-014", "name": "compressor", "status": "vibration high"},
    {"id": "M-022", "name": "conveyor belt", "status": "scheduled pm"},
    {"id": "M-031", "name": "pump station", "status": "leak sensor triaged"},
]

def list_machines(status=None):
    if status is None:
        return list(MACHINES)
    return [m for m in MACHINES if m["status"] == status]`,
  },
  'db/migration_003.sql': {
    desc: 'Composite SQL index migration created by Lane Beta',
    lang: 'sql',
    code: `-- 003: composite index for machine_id + timestamp
CREATE INDEX IF NOT EXISTS idx_events_machine_ts ON maintenance_events(machine_id, timestamp);`,
  },
  'forge.json': {
    desc: 'System manifest: build, test, and visual diff watch contracts',
    lang: 'json',
    code: `{
  "name": "plantwatch",
  "commands": {
    "build": "python3 -m compileall -q api db tests",
    "test": "python3 -m unittest discover -s tests -q",
    "contract": "",
    "browser": ""
  },
  "visual": {
    "watch": ["login.html"]
  },
  "gate": {
    "require_plan_approval": false
  },
  "models": {}
}`,
  },
};

export const TEST_SUITE_DETAILS = [
  {
    name: 'test_dependency_order',
    suite: 'TestDAG',
    desc: 'Verifies tasks execute strictly in topological order across parallel lanes',
    status: 'passed',
    timing: '0.002s',
  },
  {
    name: 'test_failed_dep_blocks_child',
    suite: 'TestDAG',
    desc: 'Asserts that a failure in an upstream dependency blocks downstream child tasks',
    status: 'passed',
    timing: '0.002s',
  },
  {
    name: 'test_unknown_dep_raises',
    suite: 'TestDAG',
    desc: 'Fails closed if a task references an undefined dependency',
    status: 'passed',
    timing: '0.001s',
  },
  {
    name: 'test_coder_model_cannot_judge',
    suite: 'TestRouter',
    desc: 'Enforces model separation: coder models are banned from judging code output',
    status: 'passed',
    timing: '0.001s',
  },
  {
    name: 'test_coder_model_preferred_for_code',
    suite: 'TestRouter',
    desc: 'Routes implementation tasks to highest scoring specialized code models',
    status: 'passed',
    timing: '0.001s',
  },
  {
    name: 'test_snapshot_and_restore',
    suite: 'TestRealms',
    desc: 'Tests non-destructive git snapshot creation and hard reset with untracked purge',
    status: 'passed',
    timing: '0.084s',
  },
  {
    name: 'test_full_loop_offline',
    suite: 'TestE2EFullLoop',
    desc: 'E2E run: catches injected visual regression at L4, triggers autonomous diagnose, and merges clean',
    status: 'passed',
    timing: '1.240s',
  },
  {
    name: 'test_rewind_after_run',
    suite: 'TestE2EFullLoop',
    desc: 'Verifies complete time-travel rewind to checkpoint #1 restores original baseline files',
    status: 'passed',
    timing: '0.194s',
  },
];
