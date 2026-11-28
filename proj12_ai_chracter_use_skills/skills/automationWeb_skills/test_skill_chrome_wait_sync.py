import pytest
from unittest.mock import MagicMock
from skill_chrome_wait_sync import execute, TOOL_SCHEMA

def test_tool_schema():
    assert isinstance(TOOL_SCHEMA, dict)
    assert TOOL_SCHEMA["name"] == "skill_chrome_wait_sync"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "check_url_match" in TOOL_SCHEMA["parameters"]
    assert "wait_for_selector" in TOOL_SCHEMA["parameters"]
    assert "wait_for_text" in TOOL_SCHEMA["parameters"]

def test_unknown_action():
    result = execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_check_url_match():
    result = execute(action="check_url_match", current_url="http://example.com", pattern="http://example.com")
    assert result == {"ok": True}

def test_check_url_match_fail():
    result = execute(action="check_url_match", current_url="http://example.com", pattern="http://another.com")
    assert result == {"ok": False}

def test_wait_for_selector_dry_run(monkeypatch):
    mock_wait_for_selector = MagicMock(return_value={"ok": True, "dry_run": True})
    monkeypatch.setattr("skill_chrome_wait_sync._wait_for_selector", mock_wait_for_selector)
    result = execute(action="wait_for_selector", selector="body", dry_run=True)
    assert result == {"ok": True, "dry_run": True}

def test_wait_for_text_dry_run(monkeypatch):
    mock_wait_for_text = MagicMock(return_value={"ok": True, "dry_run": True})
    monkeypatch.setattr("skill_chrome_wait_sync._wait_for_text", mock_wait_for_text)
    result = execute(action="wait_for_text", text="Hello", dry_run=True)
    assert result == {"ok": True, "dry_run": True}
