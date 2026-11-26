import pytest
from skill_pomodoro_focus_timer import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_pomodoro_focus_timer"
    assert TOOL_SCHEMA["description"] is not None
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "start_session" in TOOL_SCHEMA["parameters"]
    assert "complete_session" in TOOL_SCHEMA["parameters"]
    assert "daily_summary" in TOOL_SCHEMA["parameters"]

def test_unknown_action():
    result = execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_start_session(tmp_path):
    log_path = tmp_path / "focus_log.json"
    result = execute(action="start_session", task="Test Task", minutes=15, log_path=str(log_path))
    assert result["ok"]
    assert result["session"]["task"] == "Test Task"
    assert result["session"]["duration"] == 15

def test_complete_session(tmp_path):
    log_path = tmp_path / "focus_log.json"
    execute(action="start_session", task="Test Task", minutes=15, log_path=str(log_path))
    result = execute(action="complete_session", log_path=str(log_path))
    assert result["ok"]
    assert "end_time" in result["session"]

def test_daily_summary(tmp_path):
    log_path = tmp_path / "focus_log.json"
    execute(action="start_session", task="Test Task", minutes=15, log_path=str(log_path))
    execute(action="complete_session", log_path=str(log_path))
    result = execute(action="daily_summary", log_path=str(log_path))
    assert result["ok"]
    assert result["total_minutes"] == 15
