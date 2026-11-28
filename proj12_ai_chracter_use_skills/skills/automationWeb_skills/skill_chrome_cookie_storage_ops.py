import os
import json
import time
from datetime import datetime
from typing import List, Dict, Optional

TOOL_SCHEMA = {
    "name": "skill_chrome_cookie_storage_ops",
    "description": "Đọc lọc cookies trình duyệt Chrome, kiểm tra cookie hết hạn phiên đăng nhập, quản lý localStorage sessionStorage theo domain. "
                   "Inspect, filter by domain, check expiration status, and redact/export browser cookies and localStorage entries (Playwright CDP lazy-imported plus pure-Python cookie analyzer).",
    "risk_level": "confirm",
    "parameters": {
        "action": "string",
        "cookies": "list[dict]",
        "domain": "string",
        "hide_values": "bool",
        "now_ts": "float",
        "cdp_url": "string",
        "dry_run": "bool"
    }
}

def _run_cmd(cmd: str) -> str:
    try:
        import subprocess
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
        return result.stdout
    except ImportError:
        return json.dumps({"ok": False, "error": "Missing package subprocess"})
    except subprocess.CalledProcessError as e:
        return json.dumps({"ok": False, "error": str(e)})

def _fetch_raw(url: str) -> str:
    try:
        import requests
        response = requests.get(url)
        response.raise_for_status()
        return response.text
    except ImportError:
        return json.dumps({"ok": False, "error": "Missing package requests"})
    except requests.RequestException as e:
        return json.dumps({"ok": False, "error": str(e)})

def filter_cookies(cookies: List[Dict], domain: str = '', hide_values: bool = True) -> List[Dict]:
    filtered_cookies = [cookie for cookie in cookies if domain in cookie.get('domain', '')]
    if hide_values:
        for cookie in filtered_cookies:
            cookie['value'] = '[REDACTED]'
    return filtered_cookies

def check_session_expiry(cookies: List[Dict], now_ts: float = 0.0) -> List[Dict]:
    if now_ts == 0.0:
        now_ts = time.time()
    expired_cookies = [cookie for cookie in cookies if cookie.get('expiry', 0) < now_ts]
    return expired_cookies

def get_cdp_cookies(domain: str = '', cdp_url: str = 'http://localhost:9222', dry_run: bool = True) -> Dict:
    if dry_run:
        return {"ok": True, "cookies": []}
    raw_data = _fetch_raw(cdp_url)
    if raw_data.startswith('{'):
        data = json.loads(raw_data)
        cookies = data.get('cookies', [])
        filtered_cookies = filter_cookies(cookies, domain)
        return {"ok": True, "cookies": filtered_cookies}
    return {"ok": False, "error": "Failed to fetch cookies from CDP"}

def execute(action: str = "filter_cookies", **kwargs) -> Dict:
    if action == "filter_cookies":
        cookies = kwargs.get('cookies', [])
        domain = kwargs.get('domain', '')
        hide_values = kwargs.get('hide_values', True)
        return {"ok": True, "cookies": filter_cookies(cookies, domain, hide_values)}
    elif action == "check_session_expiry":
        cookies = kwargs.get('cookies', [])
        now_ts = kwargs.get('now_ts', 0.0)
        return {"ok": True, "expired_cookies": check_session_expiry(cookies, now_ts)}
    elif action == "get_cdp_cookies":
        domain = kwargs.get('domain', '')
        cdp_url = kwargs.get('cdp_url', 'http://localhost:9222')
        dry_run = kwargs.get('dry_run', True)
        return get_cdp_cookies(domain, cdp_url, dry_run)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
