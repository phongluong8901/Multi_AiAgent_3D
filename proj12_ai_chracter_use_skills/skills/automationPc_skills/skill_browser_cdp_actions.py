import json
from typing import Any, Dict

TOOL_SCHEMA = {
    "name": "skill_browser_cdp_actions",
    "description": "Interact with an existing logged-in Chrome/Edge browser via CDP (http://localhost:9222) using playwright (lazy-imported): navigate URL, click CSS/text selector, fill input field, press key, and evaluate JS (with dry_run support).",
    "risk_level": "confirm",
    "parameters": {
        "navigate": {
            "url": "str",
            "cdp_url": "str='http://localhost:9222'",
            "dry_run": "bool=True"
        },
        "click_element": {
            "selector": "str",
            "cdp_url": "str='http://localhost:9222'",
            "dry_run": "bool=True"
        },
        "fill_input": {
            "selector": "str",
            "text": "str",
            "press_enter": "bool=False",
            "cdp_url": "str='http://localhost:9222'",
            "dry_run": "bool=True"
        },
        "eval_js": {
            "script": "str",
            "cdp_url": "str='http://localhost:9222'",
            "dry_run": "bool=True"
        }
    }
}

def _lazy_import_playwright():
    try:
        from playwright.sync_api import sync_playwright
        return sync_playwright
    except ImportError:
        return None

def _run_playwright_action(action: str, **kwargs) -> Dict[str, Any]:
    sync_playwright = _lazy_import_playwright()
    if not sync_playwright:
        return {"ok": False, "error": "Missing package playwright"}

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(kwargs.get('cdp_url', 'http://localhost:9222'))
        page = browser.pages[0]
        try:
            if action == "navigate":
                if not kwargs.get('dry_run', True):
                    page.goto(kwargs['url'])
            elif action == "click_element":
                if not kwargs.get('dry_run', True):
                    page.click(kwargs['selector'])
            elif action == "fill_input":
                if not kwargs.get('dry_run', True):
                    page.fill(kwargs['selector'], kwargs['text'])
                    if kwargs.get('press_enter', False):
                        page.press(kwargs['selector'], 'Enter')
            elif action == "eval_js":
                if not kwargs.get('dry_run', True):
                    page.evaluate(kwargs['script'])
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}
        finally:
            browser.close()

def execute(action: str = "", **kwargs) -> Dict[str, Any]:
    if action not in ["navigate", "click_element", "fill_input", "eval_js"]:
        return {"ok": False, "error": "Unknown action"}
    return _run_playwright_action(action, **kwargs)
