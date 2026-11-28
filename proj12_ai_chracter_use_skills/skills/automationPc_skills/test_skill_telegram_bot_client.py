import os
import pytest
from unittest.mock import patch
from skill_telegram_bot_client import execute, TOOL_SCHEMA, _fetch_raw

def test_tool_schema():
    assert isinstance(TOOL_SCHEMA, dict)
    assert TOOL_SCHEMA["name"] == "skill_telegram_bot_client"
    assert "description" in TOOL_SCHEMA
    assert "risk_level" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA

def test_unknown_action():
    result = execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_send_message_dry_run(tmp_path, monkeypatch):
    def mock_fetch_raw(url, data=None):
        return {"ok": True, "message": "Dry run: Message not sent"}
    
    monkeypatch.setattr("skill_telegram_bot_client._fetch_raw", mock_fetch_raw)
    os.environ['TELEGRAM_BOT_TOKEN'] = 'test_token'
    os.environ['TELEGRAM_CHAT_ID'] = 'test_chat_id'
    
    result = execute(action="send_message", text="Hello, World!", dry_run=True)
    assert result == {"ok": True, "message": "Dry run: Message not sent"}

def test_send_document_dry_run(tmp_path, monkeypatch):
    def mock_fetch_raw(url, data=None):
        return {"ok": True, "message": "Dry run: Document not sent"}
    
    monkeypatch.setattr("skill_telegram_bot_client._fetch_raw", mock_fetch_raw)
    os.environ['TELEGRAM_BOT_TOKEN'] = 'test_token'
    os.environ['TELEGRAM_CHAT_ID'] = 'test_chat_id'
    
    result = execute(action="send_document", file_path="test_file.txt", dry_run=True)
    assert result == {"ok": True, "message": "Dry run: Document not sent"}

def test_get_updates(tmp_path, monkeypatch):
    def mock_fetch_raw(url, data=None):
        return '{"ok": true, "result": []}'
    
    monkeypatch.setattr("skill_telegram_bot_client._fetch_raw", mock_fetch_raw)
    os.environ['TELEGRAM_BOT_TOKEN'] = 'test_token'
    
    result = execute(action="get_updates", limit=5)
    assert result == {"ok": True, "result": []}
