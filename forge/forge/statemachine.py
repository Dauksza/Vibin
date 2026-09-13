"""The deterministic control loop:
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
        user = f"Project manifest:\n{mf_text}\n\nRequest: {self.prompt}\n\n⟪plan⟫"
        text = self.agent.complete("architect", SYS_PLAN, user)
        tasks = plan_from_json(parse_json(text, "plan"))
        self.bus.emit("plan.ok", f"plan accepted by gate · {len(tasks)} tasks · lanes: {', '.join(sorted({t.lane for t in tasks}))}")
        for t in tasks:
            self.bus.emit("task", f"  {t.id} [{t.lane}] {t.title} deps={list(t.deps)}")
        return tasks

    def _implement(self, task, pool, manifest):
        target = pool.path(task.lane)
        ctx = f"task {task.id}: {task.title}\n⟪edit:{task.id}⟫"
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
        ls = "\n".join(f"{r.layer} {r.status} {r.detail}" for r in results)
        bundle.add_text("failing-layers.txt", ls)
        user = f"lane {lane}\nlayer results:\n{ls}\n\nevidence bundle:\n{bundle.summary()}\n\n⟪fix:{lane}⟫"
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
