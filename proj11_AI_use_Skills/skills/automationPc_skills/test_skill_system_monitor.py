import skill_system_monitor as mod

def test_schema_bilingual():
    assert mod.TOOL_SCHEMA["name"] == "skill_system_monitor"
    assert "RAM" in mod.TOOL_SCHEMA["description"] and "CPU" in mod.TOOL_SCHEMA["description"]

def test_unknown_action():
    res = mod.execute("invalid_action")
    assert res["ok"] is False

def test_full_report_mocked(monkeypatch):
    monkeypatch.setattr(mod, "get_overview", lambda: {"ok": True, "cpu_percent": 15.0, "ram_percent": 50.0})
    monkeypatch.setattr(mod, "list_top_processes", lambda limit=5, sort_by="memory": {"ok": True, "processes": [{"name": "chrome.exe", "memory_mb": 900}]})
    res = mod.execute("full_report")
    assert res["ok"] is True
    assert res["top_processes"][0]["name"] == "chrome.exe"
