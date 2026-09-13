"""Ollama API client."""
from __future__ import annotations
import json, re, urllib.request, urllib.error

DEFAULT_BASE = "http://localhost:11434"

class OllamaError(Exception):
    pass

def _params(name: str) -> float:
    mm = re.search(r"(\d+(?:\.\d+)?)b", name.lower())
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
