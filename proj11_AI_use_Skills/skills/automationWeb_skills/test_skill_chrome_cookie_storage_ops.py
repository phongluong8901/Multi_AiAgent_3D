import pytest
import skill_chrome_cookie_storage_ops as mod
from unittest.mock import patch
import time  # Thêm dòng import time

def test_tool_schema():
    assert mod.TOOL_SCHEMA['name'] == 'skill_chrome_cookie_storage_ops'
    assert 'description' in mod.TOOL_SCHEMA
    assert mod.TOOL_SCHEMA['risk_level'] == 'confirm'
    assert 'parameters' in mod.TOOL_SCHEMA

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_filter_cookies(tmp_path):
    cookies = [
        {"domain": ".example.com", "name": "session_id", "value": "12345"},
        {"domain": ".anotherdomain.com", "name": "session_id", "value": "67890"}
    ]
    result = mod.execute(action="filter_cookies", cookies=cookies, domain=".example.com")
    assert result["ok"]
    assert len(result["cookies"]) == 1
    assert result["cookies"][0]["value"] == "[REDACTED]"

def test_check_session_expiry(tmp_path):
    now_ts = time.time()
    cookies = [
        {"domain": ".example.com", "name": "session_id", "value": "12345", "expiry": now_ts - 100},
        {"domain": ".example.com", "name": "session_id", "value": "67890", "expiry": now_ts + 100}
    ]
    result = mod.execute(action="check_session_expiry", cookies=cookies, now_ts=now_ts)
    assert result["ok"]
    assert len(result["expired_cookies"]) == 1

def test_get_cdp_cookies_dry_run(tmp_path):
    result = mod.execute(action="get_cdp_cookies", domain=".example.com", dry_run=True)
    assert result["ok"]
    assert result["cookies"] == []

def test_get_cdp_cookies_mock(monkeypatch):
    mock_response = '{"cookies": [{"domain": ".example.com", "name": "session_id", "value": "12345", "expiry": 1672531200}]}'
    monkeypatch.setattr(mod, "_fetch_raw", lambda _: mock_response)
    result = mod.execute(action="get_cdp_cookies", domain=".example.com", dry_run=False)
    assert result["ok"]
    assert len(result["cookies"]) == 1
    assert result["cookies"][0]["value"] == "[REDACTED]"
