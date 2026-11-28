import pytest
from skill_web_workflow_runner import execute, _run_cmd, _save_file, _load_file, TOOL_SCHEMA

def test_tool_schema():
    assert isinstance(TOOL_SCHEMA, dict)
    assert "name" in TOOL_SCHEMA
    assert "description" in TOOL_SCHEMA
    assert "risk_level" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA

def test_unknown_action():
    result = execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_validate_workflow(tmp_path):
    steps = [{"action": "navigate", "url": "http://example.com"}]
    result = execute(action="validate_workflow", steps=steps)
    assert result["ok"]

def test_render_variables():
    steps = [{"action": "navigate", "url": "http://example.com/{{var}}"}]
    variables = {"var": "test"}
    result = execute(action="render_variables", steps=steps, variables=variables)
    assert result["ok"]
    assert result["steps"][0]["url"] == "http://example.com/test"

def test_run_workflow(monkeypatch, tmp_path):
    steps = [{"action": "navigate", "url": "http://example.com"}]
    def mock_run_cmd(cmd):
        return {"ok": True, "output": ""}
    monkeypatch.setattr("skill_web_workflow_runner._run_cmd", mock_run_cmd)
    result = execute(action="run_workflow", steps=steps, dry_run=False)
    assert result["ok"]
