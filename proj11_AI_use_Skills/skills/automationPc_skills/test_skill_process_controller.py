import pytest
from skill_process_controller import ProcessControllerClient


def test_protected_pid():
    client = ProcessControllerClient()
    res = client.execute("kill_process", pid=4)
    assert res["ok"] is False


def test_unknown_action():
    client = ProcessControllerClient()
    res = client.execute("unknown_action")
    assert res["ok"] is False


def test_kill_process_missing_pid_and_name():
    client = ProcessControllerClient()
    res = client.execute("kill_process")
    assert res["ok"] is False
    assert "pid" in res["error"].lower()


def test_kill_process_auto_resolve_by_name(monkeypatch):
    import sys, types

    class FakeProc:
        def __init__(self, pid):
            self.pid = pid
        def name(self):
            return "ChatGPT.exe"

    class FakePsutil:
        def process_iter(self, attrs):
            return [types.SimpleNamespace(info={"pid": 9999, "name": "ChatGPT.exe", "memory_info": types.SimpleNamespace(rss=1024), "status": "running"})]
        def Process(self, pid):
            return FakeProc(pid)

    monkeypatch.setitem(sys.modules, "psutil", FakePsutil())

    client = ProcessControllerClient()
    res = client.execute("kill_process", name_query="ChatGPT.exe", dry_run=True)
    assert res["ok"] is True
    assert res["dry_run"] is True
    assert res["pid"] == 9999
    assert res["name"] == "ChatGPT.exe"


def test_kill_dry_run(monkeypatch):
    import sys, types

    class FakeProc:
        def __init__(self, pid):
            self.pid = pid
        def name(self):
            return "notepad.exe"

    class FakePsutil:
        def Process(self, pid):
            return FakeProc(pid)

    monkeypatch.setitem(sys.modules, "psutil", FakePsutil())

    client = ProcessControllerClient()
    r = client.execute("kill_process", pid=1234, dry_run=True)
    assert r["ok"] is True and r["dry_run"] is True and r["name"] == "notepad.exe"
