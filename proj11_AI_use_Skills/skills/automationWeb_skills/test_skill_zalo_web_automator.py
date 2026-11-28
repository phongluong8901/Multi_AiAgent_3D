import pytest
from unittest.mock import patch
from skill_zalo_web_automator import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_zalo_web_automator"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "build_send_plan" in TOOL_SCHEMA["parameters"]
    assert "send_zalo_message" in TOOL_SCHEMA["parameters"]
    assert "read_recent_messages" in TOOL_SCHEMA["parameters"]

def test_unknown_action():
    result = execute(action="unknown_action")
    assert result["ok"] is False
    assert "Unknown action" in result["error"]

def test_build_send_plan():
    result = execute(action="build_send_plan", contact_name="Alice", message="Hello Alice!")
    assert result["ok"] is True
    assert result["plan"]["contact_name"] == "Alice"
    assert result["plan"]["message"] == "Hello Alice!"

def test_send_zalo_message_dry_run():
    result = execute(action="send_zalo_message", contact_name="Alice", message="Hello Alice!", dry_run=True)
    assert result["ok"] is True
    assert result["dry_run"] is True
    assert result["message"] == "Hello Alice!"

def test_read_recent_messages_dry_run():
    result = execute(action="read_recent_messages", contact_name="Alice", limit=5, dry_run=True)
    assert result["ok"] is True
    assert result["dry_run"] is True
    assert result["limit"] == 5

@patch("skill_zalo_web_automator._send_message_via_cdp")
def test_send_zalo_message(mock_send, tmp_path):
    mock_send.return_value = {"contact_name": "Alice", "message": "Hello Alice!"}
    result = execute(action="send_zalo_message", contact_name="Alice", message="Hello Alice!", dry_run=False)
    assert result["ok"] is True
    assert result["result"] == {"contact_name": "Alice", "message": "Hello Alice!"}

@patch("skill_zalo_web_automator._read_messages_via_cdp")
def test_read_recent_messages(mock_read, tmp_path):
    mock_read.return_value = [{"contact_name": "Alice", "message": "Sample message", "timestamp": "2023-10-01T12:00:00Z"}] * 5
    result = execute(action="read_recent_messages", contact_name="Alice", limit=5, dry_run=False)
    assert result["ok"] is True
    assert len(result["messages"]) == 5
    assert result["messages"][0]["contact_name"] == "Alice"
