import pytest
import skill_dev_react_vite_scaffolder as mod
from pathlib import Path

def test_tool_schema():
    schema = mod.TOOL_SCHEMA
    assert schema["name"] == "skill_dev_react_vite_scaffolder"
    assert schema["risk_level"] == "confirm"
    assert schema["parameters"]["properties"]["action"]["enum"] == ["scaffold_react_vite_app", "generate_react_component", "generate_vite_tailwind_configs"]

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_scaffold_react_vite_app(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        return ""
    
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute(action="scaffold_react_vite_app", project_dir=str(tmp_path), app_name="test_app", dry_run=True)
    assert result == {"ok": True, "message": "Scaffolded React Vite app successfully"}
    assert not (tmp_path / "test_app" / "package.json").exists()

def test_generate_react_component(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        return ""
    
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute(action="generate_react_component", component_name="TestComponent", props=["prop1", "prop2"], endpoint="http://example.com/api", dry_run=True)
    assert result == {"ok": True, "message": "Generated React component successfully"}
    assert not (tmp_path / "src" / "TestComponent.jsx").exists()

def test_generate_vite_tailwind_configs(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        return ""
    
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute(action="generate_vite_tailwind_configs", app_name="test_app", port=5174, dry_run=True)
    assert result == {"ok": True, "message": "Generated Vite and Tailwind config successfully"}
    assert not (tmp_path / "vite.config.js").exists()
    assert not (tmp_path / "tailwind.config.js").exists()
