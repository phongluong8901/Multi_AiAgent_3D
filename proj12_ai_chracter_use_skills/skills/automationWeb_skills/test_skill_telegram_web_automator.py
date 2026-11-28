import pytest
from unittest.mock import MagicMock
from skill_telegram_web_automator import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_telegram_web_automator"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "build_telegram_plan" in TOOL_SCHEMA["parameters"]
    assert "send_telegram_web_message" in TOOL_SCHEMA["parameters"]
    assert "read_telegram_web_messages" in TOOL_SCHEMA["parameters"]

def test_unknown_action():
    result = execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_build_telegram_plan(monkeypatch):
    monkeypatch.setattr("skill_telegram_web_automator._run_cmd", MagicMock(return_value={"ok": True}))
    result = execute(action="build_telegram_plan", chat_query="test_chat", message="test_message")
    assert result["ok"]
    assert result["plan"] == {"chat_query": "test_chat", "message": "test_message"}

def test_send_telegram_web_message_dry_run(monkeypatch):
    monkeypatch.setattr("skill_telegram_web_automator._run_cmd", MagicMock(return_value={"ok": True}))
    result = execute(action="send_telegram_web_message", chat_query="test_chat", message="test_message", dry_run=True)
    assert result["ok"]
    assert result["dry_run"]

def test_read_telegram_web_messages_dry_run(monkeypatch):
    monkeypatch.setattr("skill_telegram_web_automator._fetch_raw", MagicMock(return_value={"ok": True, "data": '["message1", "message2"]'}))
    result = execute(action="read_telegram_web_messages", chat_query="test_chat", limit=2, dry_run=True)
    assert result["ok"]
    assert result["dry_run"]
    assert result["messages"] == ["message1", "message2"]
