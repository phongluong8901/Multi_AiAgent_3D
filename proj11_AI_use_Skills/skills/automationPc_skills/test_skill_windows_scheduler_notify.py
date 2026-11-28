import pytest
from unittest.mock import patch
from skill_windows_scheduler_notify import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_windows_scheduler_notify"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "parameters" in TOOL_SCHEMA
    assert "description" in TOOL_SCHEMA

def test_execute_unknown_action():
    result = execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_build_schtask_cmd_dry_run():
    result = execute(action="build_schtask_cmd", task_name="TestTask", script_path="C:\\script.bat", dry_run=True)
    assert result["ok"] is True
    assert "preview" in result

def test_list_tasks_dry_run():
    result = execute(action="list_tasks", query="TestTask", dry_run=True)
    assert result["ok"] is True
    assert "preview" in result

def test_send_notification_dry_run():
    result = execute(action="send_notification", title="Test", message="Hello", dry_run=True)
    assert result["ok"] is True
    assert "preview" in result

@patch('subprocess.run')
def test_build_schtask_cmd(mock_run):
    mock_run.return_value = type('MockResult', (object,), {'stdout': 'Task created successfully', 'stderr': '', 'returncode': 0})()
    result = execute(action="build_schtask_cmd", task_name="TestTask", script_path="C:\\script.bat")
    assert result["ok"] is True
    assert "message" in result

@patch('subprocess.run')
def test_list_tasks(mock_run):
    mock_run.return_value = type('MockResult', (object,), {'stdout': 'Task list', 'stderr': '', 'returncode': 0})()
    result = execute(action="list_tasks", query="TestTask")
    assert result["ok"] is True
    assert "tasks" in result

@patch('subprocess.run')
def test_send_notification(mock_run):
    mock_run.return_value = type('MockResult', (object,), {'stdout': 'Notification sent', 'stderr': '', 'returncode': 0})()
    result = execute(action="send_notification", title="Test", message="Hello")
    assert result["ok"] is True
    assert "message" in result
