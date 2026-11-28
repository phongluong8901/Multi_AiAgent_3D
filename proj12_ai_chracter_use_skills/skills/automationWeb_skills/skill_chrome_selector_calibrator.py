import json
import os
from typing import Dict, List, Optional

TOOL_SCHEMA = {
    "name": "skill_chrome_selector_calibrator",
    "description": "Hiệu chuẩn và quản lý cấu hình CSS selector thật cho Zalo Web Telegram Web Google Docs, lưu web_selectors.json và tự dò lại selector từ DOM thực tế. Manage externalized fallback selector profiles (web_selectors.json) for dynamic web apps like Zalo Web, Telegram Web, and Google Docs, and calibrate/discover stable selectors (data-testid, aria-label, contenteditable, role) from real captured HTML DOM snippets.",
    "risk_level": "safe",
    "parameters": {
        "app_name": "str",
        "config_path": "str",
        "html": "str",
        "target_slots": "list[str]"
    }
}

def _load_json_file(file_path: str) -> Optional[Dict]:
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            return json.load(file)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError:
        return None

def _save_json_file(file_path: str, data: Dict) -> bool:
    try:
        with open(file_path, 'w', encoding='utf-8') as file:
            json.dump(data, file, indent=4)
        return True
    except IOError:
        return False

def load_selector_profile(app_name: str, config_path: str = 'web_selectors.json') -> Dict:
    selectors = _load_json_file(config_path)
    if selectors is None:
        return {"ok": False, "error": f"Failed to load selectors from {config_path}"}
    return {"ok": True, "selectors": selectors.get(app_name, {})}

def save_selector_profile(app_name: str, selectors: Dict, config_path: str = 'web_selectors.json') -> Dict:
    current_selectors = _load_json_file(config_path) or {}
    current_selectors[app_name] = selectors
    if _save_json_file(config_path, current_selectors):
        return {"ok": True}
    return {"ok": False, "error": f"Failed to save selectors to {config_path}"}

def calibrate_from_dom(app_name: str, html: str, target_slots: Optional[List[str]] = None) -> Dict:
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return {"ok": False, "error": "Missing package BeautifulSoup4"}

    soup = BeautifulSoup(html, 'html.parser')
    discovered_selectors = {}

    for slot in target_slots or []:
        elements = soup.find_all(attrs={"data-testid": slot})
        if elements:
            discovered_selectors[slot] = f"[data-testid='{slot}']"
            continue

        elements = soup.find_all(attrs={"aria-label": slot})
        if elements:
            discovered_selectors[slot] = f"[aria-label='{slot}']"
            continue

        elements = soup.find_all(attrs={"role": slot})
        if elements:
            discovered_selectors[slot] = f"[role='{slot}']"
            continue

        elements = soup.find_all(attrs={"contenteditable": "true"})
        if elements:
            discovered_selectors[slot] = "[contenteditable='true']"
            continue

    return {"ok": True, "discovered_selectors": discovered_selectors}

def execute(action: str = "load_selector_profile", **kwargs) -> Dict:
    if action == "load_selector_profile":
        return _safe_call(load_selector_profile, kwargs)
    elif action == "save_selector_profile":
        return _safe_call(save_selector_profile, kwargs)
    elif action == "calibrate_from_dom":
        return _safe_call(calibrate_from_dom, kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
