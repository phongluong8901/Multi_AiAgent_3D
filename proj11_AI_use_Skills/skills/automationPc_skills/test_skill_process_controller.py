import skill_process_controller as mod

def test_schema_and_protected_pid():
    assert mod.TOOL_SCHEMA["name"] == "skill_process_controller"
    assert mod.execute("kill_process", pid=4)["ok"] is False
    assert mod.execute("bad")["ok"] is False

def test_kill_dry_run(monkeypatch):
    import sys, types
    class FakeProc:
        def __init__(self, pid): self.pid = pid
        def name(self): return "notepad.exe"
    monkeypatch.setitem(sys.modules, "psutil", types.SimpleNamespace(Process=FakeProc))
    r = mod.execute("kill_process", pid=1234, dry_run=True)
    assert r["ok"] is True and r["dry_run"] is True and r["name"] == "notepad.exe"
