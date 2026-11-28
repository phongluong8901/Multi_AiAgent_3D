import skill_dev_desktop_tray_app_builder as mod
import pytest
import json

def test_tool_schema():
    schema = mod.TOOL_SCHEMA
    assert schema["name"] == "skill_dev_desktop_tray_app_builder"
    assert "description" in schema
    assert schema["risk_level"] == "confirm"
    assert schema["parameters"]["properties"]["action"]["enum"] == ["generate_desktop_widget_py", "scaffold_desktop_app", "validate_widget_config"]

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_generate_desktop_widget_py(tmp_path):
    result = mod.execute("generate_desktop_widget_py", title="Test App", buttons=[{"label": "Button1", "command": "print('Hello')"}], dry_run=True)
    assert result["ok"]
    assert "Test App" in result["result"]
    assert "Button1" in result["result"]

def test_scaffold_desktop_app(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        return ""
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    
    result = mod.execute("scaffold_desktop_app", project_dir=str(tmp_path), app_name="TestApp", buttons=[{"label": "Button1", "command": "print('Hello')"}], dry_run=False)
    assert result["ok"]
    assert (tmp_path / "TestApp" / "main.py").exists()
    assert (tmp_path / "TestApp" / "README.md").exists()

def test_validate_widget_config():
    valid_config = {
        "title": "Test App",
        "buttons": [{"label": "Button1", "command": "print('Hello')"}]
    }
    invalid_config = {
        "title": "Test App",
        "buttons": [{"label": "Button1"}]
    }
    assert mod.execute("validate_widget_config", config=valid_config)["result"]
    assert not mod.execute("validate_widget_config", config=invalid_config)["result"]
