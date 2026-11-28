import pytest
import skill_linux_file_perm_sync as mod
from unittest.mock import MagicMock
import os  # Thêm dòng này để import module os

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_file_perm_sync"
    assert "description" in mod.TOOL_SCHEMA
    assert mod.TOOL_SCHEMA["risk_level"] == "confirm"
    assert "parameters" in mod.TOOL_SCHEMA
    assert "action" in mod.TOOL_SCHEMA["parameters"]["properties"]
    assert "enum" in mod.TOOL_SCHEMA["parameters"]["properties"]["action"]

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result["ok"] is False
    assert "error" in result

def test_audit_permissions(tmp_path):
    test_file = tmp_path / "test_file"
    test_file.touch()
    test_file.chmod(0o777)

    result = mod.audit_permissions(str(tmp_path), max_depth=1)
    assert result["ok"] is True
    assert str(test_file) in result["risky_paths"]

def test_build_chmod_chown_cmd(tmp_path):
    result = mod.build_chmod_chown_cmd(str(tmp_path), mode='755', owner='user', recursive=True)
    assert result["ok"] is True
    assert len(result["commands"]) == 2
    assert result["commands"][0] == ['chmod', '-R', '755', str(tmp_path)]
    assert result["commands"][1] == ['chown', '-R', 'user', str(tmp_path)]

def test_build_rsync_cmd(tmp_path):
    src = str(tmp_path / "src")
    dst = str(tmp_path / "dst")
    os.makedirs(src)
    os.makedirs(dst)

    result = mod.build_rsync_cmd(src, dst, delete=True, exclude=['*.tmp'], dry_run=True)
    assert result["ok"] is True
    assert result["command"] == ['rsync', '-av', '--delete', '--exclude', '*.tmp', '--dry-run', src + '/', dst + '/']

def test_run_cmd(monkeypatch):
    mock_run = MagicMock(return_value=(0, "stdout", "stderr"))
    monkeypatch.setattr(mod, "_run_cmd", mock_run)
    result = mod._run_cmd(['ls', '-l'])
    assert result == (0, "stdout", "stderr")
