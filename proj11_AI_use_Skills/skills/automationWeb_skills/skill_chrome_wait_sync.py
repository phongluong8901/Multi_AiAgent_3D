import re
import time
import json
from typing import Dict, Any

TOOL_SCHEMA = {
    "name": "skill_chrome_wait_sync",
    "description": "Build and run smart browser synchronization waits (Playwright CDP lazy-imported) and evaluate pure-Python wait conditions (URL regex match, text presence, timeout clamping).",
    "risk_level": "safe",
    "parameters": {
        "check_url_match": {
            "current_url": "str",
            "pattern": "str"
        },
        "wait_for_selector": {
            "selector": "str",
            "state": "str",
            "timeout_ms": "int",
            "cdp_url": "str",
            "dry_run": "bool"
        },
        "wait_for_text": {
            "text": "str",
            "timeout_ms": "int",
            "cdp_url": "str",
            "dry_run": "bool"
        }
    }
}

def _lazy_import_playwright():
    try:
        from playwright.sync_api import sync_playwright
        return sync_playwright
    except ImportError:
        return None

def _check_url_match(current_url: str, pattern: str) -> bool:
    return re.match(pattern, current_url) is not None

def _run_cmd(cmd: str) -> Dict[str, Any]:
    try:
        import subprocess
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=10)
        return {"ok": True, "stdout": result.stdout, "stderr": result.stderr}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _wait_for_selector(selector: str, state: str, timeout_ms: int, cdp_url: str, dry_run: bool) -> Dict[str, Any]:
    sync_playwright = _lazy_import_playwright()
    if not sync_playwright:
        return {"ok": False, "error": "Missing package playwright"}

    if dry_run:
        return {"ok": True, "dry_run": True}

    try:
        with sync_playwright() as p:
            browser = p.chromium.connect_over_cdp(cdp_url)
            page = browser.contexts[0].pages[0]
            page.wait_for_selector(selector, state=state, timeout=timeout_ms)
            return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _wait_for_text(text: str, timeout_ms: int, cdp_url: str, dry_run: bool) -> Dict[str, Any]:
    sync_playwright = _lazy_import_playwright()
    if not sync_playwright:
        return {"ok": False, "error": "Missing package playwright"}

    if dry_run:
        return {"ok": True, "dry_run": True}

    try:
        with sync_playwright() as p:
            browser = p.chromium.connect_over_cdp(cdp_url)
            page = browser.contexts[0].pages[0]
            page.wait_for_function(f"document.body.innerText.includes('{text}')", timeout=timeout_ms)
            return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def execute(action: str = "check_url_match", **kwargs) -> Dict[str, Any]:
    if action == "check_url_match":
        current_url = kwargs.get("current_url", "")
        pattern = kwargs.get("pattern", "")
        return {"ok": _check_url_match(current_url, pattern)}
    elif action == "wait_for_selector":
        selector = kwargs.get("selector", "")
        state = kwargs.get("state", "visible")
        timeout_ms = kwargs.get("timeout_ms", 10000)
        cdp_url = kwargs.get("cdp_url", "http://localhost:9222")
        dry_run = kwargs.get("dry_run", True)
        return _wait_for_selector(selector, state, timeout_ms, cdp_url, dry_run)
    elif action == "wait_for_text":
        text = kwargs.get("text", "")
        timeout_ms = kwargs.get("timeout_ms", 10000)
        cdp_url = kwargs.get("cdp_url", "http://localhost:9222")
        dry_run = kwargs.get("dry_run", True)
        return _wait_for_text(text, timeout_ms, cdp_url, dry_run)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
