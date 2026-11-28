import pytest
import skill_chrome_hitl_captcha_guard as mod
from unittest.mock import patch
import json  # Thêm dòng import json

def test_tool_schema():
    assert mod.TOOL_SCHEMA['name'] == 'skill_chrome_hitl_captcha_guard'
    assert 'description' in mod.TOOL_SCHEMA
    assert mod.TOOL_SCHEMA['risk_level'] == 'safe'
    assert 'parameters' in mod.TOOL_SCHEMA

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action"}

def test_detect_blocker(tmp_path):
    html_captcha = "<html><body>Cloudflare Turnstile</body></html>"
    html_qr_login = "<html><body>scan the code</body></html>"
    html_2fa_otp = "<html><body>one-time password</body></html>"
    html_no_blocker = "<html><body>No blockers here</body></html>"

    assert mod.detect_blocker(html=html_captcha) == {"ok": True, "blocker": "captcha"}
    assert mod.detect_blocker(html=html_qr_login) == {"ok": True, "blocker": "qr_login"}
    assert mod.detect_blocker(html=html_2fa_otp) == {"ok": True, "blocker": "2fa_otp"}
    assert mod.detect_blocker(html=html_no_blocker) == {"ok": False, "blocker": None}

def test_create_pause_ticket(tmp_path):
    store_path = tmp_path / "hitl_state.json"
    result = mod.create_pause_ticket(reason="Test reason", url="http://example.com", blocker_type="captcha", store_path=str(store_path))
    assert result == {"ok": True}
    with open(store_path, 'r') as f:
        ticket = json.load(f)
    assert ticket == {
        "reason": "Test reason",
        "url": "http://example.com",
        "blocker_type": "captcha",
        "status": "NEED_HUMAN"
    }

def test_check_resume_condition(tmp_path):
    html_no_blocker = "<html><body>No blockers here</body></html>"
    result = mod.check_resume_condition(current_url="http://example.com", current_html=html_no_blocker, expected_url_regex=r"http://example\.com")
    assert result == {"ok": True, "message": "No blockers detected, safe to resume"}

    result = mod.check_resume_condition(current_url="http://wrong-url.com", current_html=html_no_blocker, expected_url_regex=r"http://example\.com")
    assert result == {"ok": False, "message": "URL does not match expected pattern"}

    html_captcha = "<html><body>Cloudflare Turnstile</body></html>"
    result = mod.check_resume_condition(current_url="http://example.com", current_html=html_captcha, expected_url_regex=r"http://example\.com")
    assert result == {"ok": False, "message": "Blocker still present"}
