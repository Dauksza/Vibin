"""forge.json — the project manifest. The system reads it; models only propose."""
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
