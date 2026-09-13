"""Offline end-to-end demo of PlantWatch scenario:
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

API = """\"\"\"PlantWatch machines API — stdlib only.\"\"\"
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

SEED = """\"\"\"Seed + backfill for PlantWatch events.\"\"\"
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
