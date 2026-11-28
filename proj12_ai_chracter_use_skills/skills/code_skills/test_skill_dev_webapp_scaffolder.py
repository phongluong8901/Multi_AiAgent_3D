import skill_dev_webapp_scaffolder as mod
import pytest
from pathlib import Path

def test_tool_schema():
    schema = mod.TOOL_SCHEMA
    assert schema["name"] == "skill_dev_webapp_scaffolder"
    assert schema["risk_level"] == "confirm"
    assert schema["parameters"]["properties"]["action"]["enum"] == ["list_web_templates", "scaffold_webapp", "generate_single_file_html"]

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_list_web_templates():
    result = mod.execute(action="list_web_templates")
    assert result == {"ok": True, "templates": ["fastapi_htmx", "static_spa", "node_express"]}

def test_scaffold_webapp(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        return ""
    
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute(action="scaffold_webapp", project_dir=str(tmp_path), app_name="test_app", stack="fastapi_htmx", dry_run=True)
    assert result == {"ok": True, "message": f"Scaffolded fastapi_htmx app at {tmp_path / 'test_app'}"}

def test_generate_single_file_html():
    html_content = mod.execute(action="generate_single_file_html", title="Test Dashboard", api_base="http://127.0.0.1:8765", panels=["Panel 1", "Panel 2"])["html_content"]
    assert "<title>Test Dashboard</title>" in html_content
    assert "<div>Panel 1</div>" in html_content
    assert "<div>Panel 2</div>" in html_content
