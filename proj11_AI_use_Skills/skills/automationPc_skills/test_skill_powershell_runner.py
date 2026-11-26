import pytest
from unittest.mock import patch, MagicMock
from skill_powershell_runner import execute, TOOL_SCHEMA
import subprocess

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_powershell_runner"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA
    assert "action" in TOOL_SCHEMA["parameters"]["properties"]
    assert "command" in TOOL_SCHEMA["parameters"]["properties"]
    assert "timeout" in TOOL_SCHEMA["parameters"]["properties"]
    assert "parse_json" in TOOL_SCHEMA["parameters"]["properties"]

def test_execute_unknown_action():
    result = execute(action="unknown_action", command="echo Hello")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_execute_run_ps():
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout="Hello\n", stderr="", returncode=0)
        result = execute(action="run_ps", command="echo Hello")
        assert result == {"ok": True, "output": "Hello"}

def test_execute_run_ps_timeout():
    with patch("subprocess.run") as mock_run:
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="echo Hello", timeout=1)
        result = execute(action="run_ps", command="echo Hello", timeout=1)
        assert result == {"ok": False, "error": "Command timed out."}

def test_execute_run_ps_error():
    with patch("subprocess.run") as mock_run:
        mock_run.side_effect = subprocess.CalledProcessError(returncode=1, cmd="echo Hello", stderr="Error\n")
        result = execute(action="run_ps", command="echo Hello")
        assert result == {"ok": False, "error": "Error"}

def test_execute_run_ps_parse_json():
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout='{"key": "value"}\n', stderr="", returncode=0)
        result = execute(action="run_ps", command="echo {\"key\": \"value\"}", parse_json=True)
        assert result == {"ok": True, "output": {"key": "value"}}

def test_execute_run_cmd():
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout="Hello\n", stderr="", returncode=0)
        result = execute(action="run_cmd", command="echo Hello")
        assert result == {"ok": True, "output": "Hello"}

def test_execute_run_cmd_timeout():
    with patch("subprocess.run") as mock_run:
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="echo Hello", timeout=1)
        result = execute(action="run_cmd", command="echo Hello", timeout=1)
        assert result == {"ok": False, "error": "Command timed out."}

def test_execute_run_cmd_error():
    with patch("subprocess.run") as mock_run:
        mock_run.side_effect = subprocess.CalledProcessError(returncode=1, cmd="echo Hello", stderr="Error\n")
        result = execute(action="run_cmd", command="echo Hello")
        assert result == {"ok": False, "error": "Error"}
