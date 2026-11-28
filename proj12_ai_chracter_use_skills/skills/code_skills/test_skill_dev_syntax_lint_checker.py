import skill_dev_syntax_lint_checker as mod
import pytest
from pathlib import Path

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "check_python_syntax" in actions
    assert "check_json_file" in actions
    assert "run_language_check" in actions

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_check_python_syntax(tmp_path):
    test_file = tmp_path / "test.py"
    test_file.write_text("def test():\n    print('Hello, world!')")
    result = mod.execute("check_python_syntax", file_path=str(test_file))
    assert result["ok"]

def test_check_json_file(tmp_path):
    test_file = tmp_path / "test.json"
    test_file.write_text('{"key": "value"}')
    result = mod.execute("check_json_file", file_path=str(test_file))
    assert result["ok"]

def test_run_language_check_dry_run(tmp_path, monkeypatch):
    test_file = tmp_path / "test.py"
    test_file.write_text("def test():\n    print('Hello, world!')")
    monkeypatch.setattr(mod, "_run_cmd", lambda cmd, cwd: "Dry run output")
    result = mod.execute("run_language_check", file_path=str(test_file), lang="python", dry_run=True)
    assert result["ok"]
    assert "Dry run output" in result["message"]
