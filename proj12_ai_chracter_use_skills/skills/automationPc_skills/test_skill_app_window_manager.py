import skill_app_window_manager as mod

def test_schema_bilingual():
    assert mod.TOOL_SCHEMA["name"] == "skill_app_window_manager"
    assert "cửa sổ" in mod.TOOL_SCHEMA["description"]

def test_list_windows_powershell_fallback(monkeypatch):
    import builtins
    real_import = builtins.__import__
    def fake_import(name, *a, **kw):
        if name == "pygetwindow":
            raise ImportError("no pygetwindow on linux")
        return real_import(name, *a, **kw)
    monkeypatch.setattr(builtins, "__import__", fake_import)
    class FakeProc:
        returncode = 0
        stdout = '[{"Id": 123, "ProcessName": "Code", "MainWindowTitle": "VS Code"}]'
        stderr = ""
    monkeypatch.setattr(mod.subprocess, "run", lambda *a, **kw: FakeProc())
    res = mod.execute("list_windows")
    assert res["ok"] is True
    assert res["windows"][0]["title"] == "VS Code"
