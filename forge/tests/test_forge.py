import json, tempfile, unittest
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
