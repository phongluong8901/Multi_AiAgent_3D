import pytest
from unittest.mock import patch, MagicMock
from skill_power_display_control import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_power_display_control"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA
    assert "action" in TOOL_SCHEMA["parameters"]["properties"]
    assert "level" in TOOL_SCHEMA["parameters"]["properties"]
    assert "minutes" in TOOL_SCHEMA["parameters"]["properties"]
    assert "dry_run" in TOOL_SCHEMA["parameters"]["properties"]

@patch("subprocess.run")
def test_get_battery(mock_run):
    mock_run.return_value = MagicMock(returncode=0, stdout="Battery Info")
    result = execute("get_battery")
    assert result["ok"] is True
    assert result["battery_info"] == "Battery Info"

@patch("subprocess.run")
def test_set_brightness(mock_run):
    mock_run.return_value = MagicMock(returncode=0)
    result = execute("set_brightness", level=50, dry_run=False)
    assert result["ok"] is True
    assert result["brightness"] == 50

def test_set_brightness_dry_run():
    result = execute("set_brightness", level=50, dry_run=True)
    assert result["ok"] is True
    assert result["preview"] == "Would set brightness to 50"

@patch("subprocess.run")
def test_lock_screen(mock_run):
    mock_run.return_value = MagicMock(returncode=0)
    result = execute("lock_screen", dry_run=False)
    assert result["ok"] is True
    assert result["message"] == "Screen locked"

def test_lock_screen_dry_run():
    result = execute("lock_screen", dry_run=True)
    assert result["ok"] is True
    assert result["preview"] == "Would lock the screen"

@patch("subprocess.run")
def test_schedule_shutdown(mock_run):
    mock_run.return_value = MagicMock(returncode=0)
    result = execute("schedule_shutdown", minutes=10, dry_run=False)
    assert result["ok"] is True
    assert result["message"] == "Shutdown scheduled in 10 minutes"

def test_schedule_shutdown_dry_run():
    result = execute("schedule_shutdown", minutes=10, dry_run=True)
    assert result["ok"] is True
    assert result["preview"] == "Would schedule shutdown in 10 minutes"

@patch("subprocess.run")
def test_cancel_shutdown(mock_run):
    mock_run.return_value = MagicMock(returncode=0)
    result = execute("cancel_shutdown", dry_run=False)
    assert result["ok"] is True
    assert result["message"] == "Shutdown cancelled"

def test_cancel_shutdown_dry_run():
    result = execute("cancel_shutdown", dry_run=True)
    assert result["ok"] is True
    assert result["preview"] == "Would cancel shutdown"

def test_unknown_action():
    result = execute("unknown_action")
    assert result["ok"] is False
    assert "Unknown action" in result["error"]
