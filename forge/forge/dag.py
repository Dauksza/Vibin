"""Deterministic task graph execution: lanes in parallel, deps enforced by the system."""
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
