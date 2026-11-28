import skill_dev_test_runner_diag as mod
import pytest
from pathlib import Path

def test_tool_schema_actions():
    assert mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"] == ["detect_test_framework", "parse_test_failures", "run_project_tests"]

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_detect_test_framework(tmp_path):
    (tmp_path / "pytest.ini").touch()
    result = mod.execute("detect_test_framework", project_dir=str(tmp_path))
    assert result == {"ok": True, "framework": "pytest"}

def test_parse_test_failures_python():
    raw_output = "test_module.py:10: AssertionError: assert 1 == 2"
    result = mod.execute("parse_test_failures", raw_output=raw_output, lang="python")
    assert result == {"ok": True, "failures": [{"file": "test_module.py", "line": 10, "error": "AssertionError: assert 1 == 2"}]}

def test_run_project_tests_dry_run(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        return "Dry run command: " + " ".join(cmd)

    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    (tmp_path / "pytest.ini").touch()
    result = mod.execute("run_project_tests", project_dir=str(tmp_path), dry_run=True)
    assert result == {"ok": True, "command": "pytest", "dry_run": True}
