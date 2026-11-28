import skill_dev_sandbox_shell_runner as mod
import pytest
from unittest.mock import MagicMock
import subprocess  # Thêm dòng này để import subprocess

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert set(actions) == {"validate_command_safety", "run_workspace_cmd", "manage_bg_process"}

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_validate_command_safety(tmp_path):
    result = mod.validate_command_safety("rm -rf /")
    assert result == {'ok': True, 'safe': False, 'reason': "Command matches destructive pattern: rm\\s+-rf\\s+/"}
    
    result = mod.validate_command_safety("echo hello")
    assert result == {'ok': True, 'safe': True, 'reason': "Command is safe"}

def test_run_workspace_cmd(tmp_path, monkeypatch):
    mock_run_cmd = MagicMock(return_value=subprocess.CompletedProcess(args=[], returncode=0, stdout="Hello", stderr=""))
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    
    result = mod.run_workspace_cmd("echo hello", dry_run=False)
    assert result == {'ok': True, 'returncode': 0, 'stdout': 'Hello', 'stderr': ''}
    
    result = mod.run_workspace_cmd("echo hello", dry_run=True)
    assert result == {'ok': True, 'dry_run': True, 'command': 'echo hello'}

def test_manage_bg_process(tmp_path, monkeypatch):
    mock_spawn_bg = MagicMock(return_value=12345)
    mock_is_pid_alive = MagicMock(return_value=True)
    mock_terminate_pid = MagicMock(return_value=True)
    monkeypatch.setattr(mod, "_spawn_bg", mock_spawn_bg)
    monkeypatch.setattr(mod, "_is_pid_alive", mock_is_pid_alive)
    monkeypatch.setattr(mod, "_terminate_pid", mock_terminate_pid)
    
    state_path = tmp_path / "bg_procs.json"
    
    result = mod.manage_bg_process(op="start", name="dev_server", command="echo hello", state_path=state_path, dry_run=False)
    assert result == {'ok': True, 'pid': 12345, 'log_path': 'dev_server.log'}
    
    result = mod.manage_bg_process(op="status", name="dev_server", state_path=state_path)
    assert result == {'ok': True, 'name': 'dev_server', 'pid': 12345, 'is_alive': True}
    
    result = mod.manage_bg_process(op="stop", name="dev_server", state_path=state_path)
    assert result == {'ok': True, 'pid': 12345, 'terminated': True}
