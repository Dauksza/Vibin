"""Capability-based model routing with first-class fallback chains."""
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
