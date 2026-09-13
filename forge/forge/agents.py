"""Agents propose; system disposes. Implements OllamaAgent and scripted FakeAgent."""
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
    "Respond with JSON only: {\"tasks\":[{\"id\":\"t1\",\"title\":\"...\",\"lane\":\"alpha\",\"kind\":\"code\",\"deps\":[]}]}. "
    "Lanes run in parallel as git worktrees; deps must reference existing ids."
)
SYS_EDIT = (
    "You implement one task in an existing project. Respond with JSON only: {\"files\":{\"path/to/file\":\"full new content\"}}. "
    "Relative paths only, no '..'."
)
SYS_FIX = "You receive an evidence bundle of a verification failure. Respond with JSON only: {\"files\":{...}} to fix it."
JUDGE_SYS = (
    "You are a strict verification judge. Given layer results and an evidence bundle, output JSON: {\"verdict\":\"pass\"|\"fail\"}. "
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
        text = self.complete("judge", JUDGE_SYS, f"Layer results:\n{layer_summary}\n\nEvidence:\n{bundle_summary}")
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
