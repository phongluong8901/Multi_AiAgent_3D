import skill_dev_git_version_ops as mod
import pytest
from pathlib import Path

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert actions == ["parse_git_status_porcelain", "build_commit_message", "run_git_op"]

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_parse_git_status_porcelain(tmp_path):
    raw_status = " M file1.txt\nA  file2.txt\n?? file3.txt"
    result = mod.execute(action="parse_git_status_porcelain", raw_status=raw_status)
    assert result == {
        "staged": ["file2.txt"],
        "modified": ["file1.txt"],
        "untracked": ["file3.txt"]
    }

def test_build_commit_message():
    result = mod.execute(action="build_commit_message", change_type="fix", scope="ui", summary="fix button alignment")
    assert result == {"ok": True, "message": "fix(ui): fix button alignment"}

def test_run_git_op_dry_run(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        return f"Mocked: {' '.join(cmd)}"

    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute(action="run_git_op", repo_dir=str(tmp_path), op="commit", message="test commit", dry_run=True)
    assert result == {"ok": True, "dry_run": True, "command": "git commit -m test commit"}
