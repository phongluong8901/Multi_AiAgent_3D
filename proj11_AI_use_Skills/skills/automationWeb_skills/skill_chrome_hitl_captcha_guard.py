import json
import re
import os
from typing import Dict, Any

TOOL_SCHEMA = {
    "name": "skill_chrome_hitl_captcha_guard",
    "description": "Phát hiện Captcha Cloudflare reCAPTCHA hCaptcha 2FA OTP quét mã QR, tạm dừng tự động hóa web gọi người dùng Human-in-the-Loop và kiểm tra điều kiện tiếp tục. Detect Captcha (Cloudflare Turnstile, reCAPTCHA, hCaptcha, puzzle), QR login, 2FA/OTP walls from URL/HTML/text; persist NEED_HUMAN pause tickets to JSON; and verify resume conditions once the user clears the blocker.",
    "risk_level": "safe",
    "parameters": {
        "url": "URL to check for blockers",
        "html": "HTML content to check for blockers",
        "page_text": "Text content to check for blockers",
        "reason": "Reason for pausing automation",
        "blocker_type": "Type of blocker detected",
        "store_path": "Path to store pause tickets",
        "current_url": "Current URL to check for resume conditions",
        "expected_url_regex": "Regex pattern for expected URL after resuming"
    }
}

def _detect_captcha(html: str) -> bool:
    captcha_patterns = [
        r'Cloudflare\s*Turnstile',
        r'reCAPTCHA',
        r'hCaptcha',
        r'puzzle'
    ]
    return any(re.search(pattern, html, re.IGNORECASE) for pattern in captcha_patterns)

def _detect_qr_login(html: str) -> bool:
    qr_login_patterns = [
        r'QR\s*Code',
        r'scan\s*the\s*code'
    ]
    return any(re.search(pattern, html, re.IGNORECASE) for pattern in qr_login_patterns)

def _detect_2fa_otp(html: str) -> bool:
    two_fa_patterns = [
        r'2FA',
        r'OTP',
        r'one-time\s*password'
    ]
    return any(re.search(pattern, html, re.IGNORECASE) for pattern in two_fa_patterns)

def detect_blocker(url: str = '', html: str = '', page_text: str = '') -> Dict[str, Any]:
    if _detect_captcha(html):
        return {"ok": True, "blocker": "captcha"}
    if _detect_qr_login(html):
        return {"ok": True, "blocker": "qr_login"}
    if _detect_2fa_otp(html):
        return {"ok": True, "blocker": "2fa_otp"}
    return {"ok": False, "blocker": None}

def _write_to_json(data: Dict[str, Any], store_path: str) -> Dict[str, Any]:
    try:
        with open(store_path, 'w') as f:
            json.dump(data, f)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def create_pause_ticket(reason: str, url: str = '', blocker_type: str = 'captcha', store_path: str = 'hitl_state.json') -> Dict[str, Any]:
    ticket = {
        "reason": reason,
        "url": url,
        "blocker_type": blocker_type,
        "status": "NEED_HUMAN"
    }
    return _write_to_json(ticket, store_path)

def _read_from_json(store_path: str) -> Dict[str, Any]:
    try:
        with open(store_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        return {"ok": False, "error": str(e)}

def check_resume_condition(current_url: str, current_html: str = '', expected_url_regex: str = '') -> Dict[str, Any]:
    if expected_url_regex and not re.match(expected_url_regex, current_url):
        return {"ok": False, "message": "URL does not match expected pattern"}
    
    if detect_blocker(html=current_html)["blocker"]:
        return {"ok": False, "message": "Blocker still present"}
    
    return {"ok": True, "message": "No blockers detected, safe to resume"}

def execute(action: str = "", **kwargs) -> Dict[str, Any]:
    if action == "detect_blocker":
        return _safe_call(detect_blocker, kwargs)
    elif action == "create_pause_ticket":
        return _safe_call(create_pause_ticket, kwargs)
    elif action == "check_resume_condition":
        return _safe_call(check_resume_condition, kwargs)
    else:
        return {"ok": False, "error": "Unknown action"}

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
