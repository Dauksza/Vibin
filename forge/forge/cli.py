"""forge CLI — control plane entry point."""
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
        print(f"{m['name']}\t{m['params']}B\t{m['size'] // 1_000_000}MB")

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
