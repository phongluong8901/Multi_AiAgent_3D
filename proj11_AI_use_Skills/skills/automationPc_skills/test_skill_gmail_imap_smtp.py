import pytest
from unittest.mock import patch
from skill_gmail_imap_smtp import execute, _fetch_recent_emails, _send_email_via_smtp

def test_tool_schema():
    schema = execute("get_tool_schema")
    assert schema["name"] == "skill_gmail_imap_smtp"
    assert schema["risk_level"] == "confirm"
    assert "list_recent_emails" in schema["parameters"]["actions"]
    assert "build_email_message" in schema["parameters"]["actions"]
    assert "send_email" in schema["parameters"]["actions"]

def test_unknown_action():
    result = execute("unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_list_recent_emails(monkeypatch):
    mock_emails = [
        {'subject': 'Test Subject', 'from': 'test@example.com', 'date': '2023-10-01', 'body': 'Test Body'}
    ]
    monkeypatch.setattr("skill_gmail_imap_smtp._fetch_recent_emails", lambda *args, **kwargs: mock_emails)
    result = execute("list_recent_emails")
    assert result["ok"]
    assert result["emails"] == mock_emails

def test_build_email_message():
    result = execute("build_email_message", sender="from@example.com", to="to@example.com", subject="Test", body="Hello")
    assert result["ok"]
    assert result["message"]["From"] == "from@example.com"
    assert result["message"]["To"] == "to@example.com"
    assert result["message"]["Subject"] == "Test"
    assert result["message"].get_payload()[0].get_payload() == "Hello"

def test_send_email_dry_run(monkeypatch):
    mock_send = lambda *args, **kwargs: {"ok": True}
    monkeypatch.setattr("skill_gmail_imap_smtp._send_email_via_smtp", mock_send)
    result = execute("send_email", to="to@example.com", subject="Test", body="Hello", dry_run=True)
    assert result["ok"]

def test_send_email(monkeypatch):
    mock_send = lambda *args, **kwargs: {"ok": True}
    monkeypatch.setattr("skill_gmail_imap_smtp._send_email_via_smtp", mock_send)
    result = execute("send_email", to="to@example.com", subject="Test", body="Hello", dry_run=False)
    assert result["ok"]
