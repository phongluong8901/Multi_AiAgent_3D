import skill_dev_python_tool_scaffolder as mod
import pytest
from pathlib import Path

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert set(actions) == {"scaffold_python_tool", "generate_pyproject_toml", "generate_skill_caller_stub"}

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_generate_pyproject_toml(tmp_path):
    result = mod.execute("generate_pyproject_toml", tool_name="test_tool", deps=["numpy", "pandas"])
    assert result["ok"]
    assert "numpy" in result["pyproject_content"]
    assert "pandas" in result["pyproject_content"]

def test_generate_skill_caller_stub(tmp_path):
    result = mod.execute("generate_skill_caller_stub", skill_paths=["skill1", "skill2"])
    assert result["ok"]
    assert "from skill1 import execute as skill1_execute" in result["stub_content"]
    assert "from skill2 import execute as skill2_execute" in result["stub_content"]

def test_scaffold_python_tool(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        return f"Mocked: {cmd}"

    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute("scaffold_python_tool", project_dir=str(tmp_path), tool_name="test_tool", template="cli", dry_run=False)
    assert result["ok"]
    assert (tmp_path / "test_tool" / "pyproject.toml").exists()
    assert (tmp_path / "test_tool" / "test_tool.py").exists()
