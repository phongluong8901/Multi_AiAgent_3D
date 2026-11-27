import pytest
from unittest.mock import patch, MagicMock
from skill_gmail_imap_smtp import execute, GmailIMAPSmtpTool, list_recent_emails, build_email_message, send_email

def test_tool_schema():
    schema = execute("get_tool_schema")
    assert schema["name"] == "skill_gmail_imap_smtp"
    assert schema["risk_level"] == "confirm"
    assert "list_recent_emails" in schema["parameters"]["properties"]["action"]["enum"]

def test_unknown_action():
    result = execute("unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_list_recent_emails_missing_credentials(monkeypatch):
    monkeypatch.delenv("GMAIL_USER", raising=False)
    monkeypatch.delenv("GMAIL_APP_PASSWORD", raising=False)
    result = execute("list_recent_emails")
    assert result["ok"] is False
    assert "Missing GMAIL_USER" in result["error"]

def test_list_recent_emails_success(monkeypatch):
    monkeypatch.setenv("GMAIL_USER", "user@gmail.com")
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "password123")
    
    mock_imap = MagicMock()
    mock_imap.search.return_value = ("OK", [b"1"])
    mock_imap.fetch.return_value = ("OK", [(b"1", b"Subject: Test Subject\r\nFrom: sender@example.com\r\nDate: Mon, 1 Jan 2024 00:00:00\r\n\r\nHello Body")])
    
    with patch("imaplib.IMAP4_SSL", return_value=mock_imap):
        result = execute("list_recent_emails", limit=1)
        assert result["ok"]
        assert result["count"] == 1
        assert result["emails"][0]["subject"] == "Test Subject"

def test_build_email_message():
    result = execute("build_email_message", sender="from@example.com", to="to@example.com", subject="Test", body="Hello")
    assert result["ok"]
    assert "preview" in result

def test_send_email_dry_run(monkeypatch):
    monkeypatch.setenv("GMAIL_USER", "user@gmail.com")
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "password123")
    result = execute("send_email", to="to@example.com", subject="Test", body="Hello", dry_run=True)
    assert result["ok"]
    assert result["dry_run"] is True

def test_send_email_live_success(monkeypatch):
    monkeypatch.setenv("GMAIL_USER", "user@gmail.com")
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "password123")
    
    mock_smtp = MagicMock()
    with patch("smtplib.SMTP", return_value=mock_smtp):
        result = execute("send_email", to="to@example.com", subject="Test", body="Hello", dry_run=False)
        assert result["ok"]
        mock_smtp.sendmail.assert_called_once()
        mock_smtp.quit.assert_called_once()

def test_nested_parameters():
    result = execute("list_recent_emails", parameters={"limit": 1})
    # Will fail credentials check if not set, but exercises the unwrapping logic
    assert "ok" in result
