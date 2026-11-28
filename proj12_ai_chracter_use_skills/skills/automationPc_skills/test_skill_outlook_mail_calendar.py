import pytest
from unittest.mock import MagicMock
from skill_outlook_mail_calendar import execute, TOOL_SCHEMA

def test_tool_schema():
    assert isinstance(TOOL_SCHEMA, dict)
    assert TOOL_SCHEMA["name"] == "skill_outlook_mail_calendar"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "parameters" in TOOL_SCHEMA

def test_unknown_action():
    result = execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_create_ics_event(tmp_path, monkeypatch):
    mock_ics = MagicMock()
    monkeypatch.setattr("skill_outlook_mail_calendar._create_ics_event", mock_ics)
    mock_ics.return_value = {"ok": True, "path": "event.ics"}
    
    result = execute(action="create_ics_event", title="Test Event", start_iso="2023-10-01T10:00:00", end_iso="2023-10-01T11:00:00", output_path=str(tmp_path / "event.ics"))
    assert result == {"ok": True, "path": "event.ics"}

def test_draft_outlook_email(monkeypatch):
    mock_draft = MagicMock()
    monkeypatch.setattr("skill_outlook_mail_calendar._draft_outlook_email", mock_draft)
    mock_draft.return_value = {"ok": True, "dry_run": True, "to": "test@example.com", "subject": "Test Subject", "body": "Test Body"}
    
    result = execute(action="draft_outlook_email", to="test@example.com", subject="Test Subject", body="Test Body", dry_run=True)
    assert result == {"ok": True, "dry_run": True, "to": "test@example.com", "subject": "Test Subject", "body": "Test Body"}

def test_list_outlook_inbox(monkeypatch):
    mock_inbox = MagicMock()
    monkeypatch.setattr("skill_outlook_mail_calendar._list_outlook_inbox", mock_inbox)
    mock_inbox.return_value = {"ok": True, "messages": [{"subject": "Test Subject", "sender": "test@example.com", "received_time": "2023-10-01 10:00:00", "body": "Test Body"}]}
    
    result = execute(action="list_outlook_inbox", limit=1)
    assert result == {"ok": True, "messages": [{"subject": "Test Subject", "sender": "test@example.com", "received_time": "2023-10-01 10:00:00", "body": "Test Body"}]}
