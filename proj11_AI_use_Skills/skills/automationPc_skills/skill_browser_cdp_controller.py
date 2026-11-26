import json
from typing import Dict, Any

TOOL_SCHEMA = {
    "name": "skill_browser_cdp_controller",
    "description": "Connect to an existing Chrome/Edge session over CDP (http://localhost:9222) using playwright (lazy-imported) to list tabs, read page text, fill forms, and click elements without re-logging in.",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["build_chrome_debug_cmd", "list_tabs", "extract_active_tab"]
            },
            "port": {
                "type": "integer",
                "default": 9222
            },
            "user_data_dir": {
                "type": "string",
                "default": ""
            },
            "cdp_url": {
                "type": "string",
                "default": "http://localhost:9222"
            }
        },
        "required": ["action"]
    }
}

def execute(action: str, **kwargs) -> Dict[str, Any]:
    if action == "build_chrome_debug_cmd":
        return build_chrome_debug_cmd(**kwargs)
    elif action == "list_tabs":
        return list_tabs(**kwargs)
    elif action == "extract_active_tab":
        return extract_active_tab(**kwargs)
    else:
        return {"ok": False, "error": "Invalid action"}

def build_chrome_debug_cmd(port: int = 9222, user_data_dir: str = '') -> Dict[str, Any]:
    try:
        import shlex
    except ImportError:
        return {"ok": False, "error": "Missing package shlex"}
    
    cmd = f'chrome --remote-debugging-port={port}'
    if user_data_dir:
        cmd += f' --user-data-dir="{shlex.quote(user_data_dir)}"'
    return {"ok": True, "command": cmd}

def list_tabs(cdp_url: str = 'http://localhost:9222') -> Dict[str, Any]:
    try:
        import requests  # Lazy import
        response = requests.get(f'{cdp_url}/json')
        response.raise_for_status()
        tabs = response.json()
    except requests.RequestException as e:
        return {"ok": False, "error": str(e)}
    return {"ok": True, "tabs": tabs}

def extract_active_tab(cdp_url: str = 'http://localhost:9222') -> Dict[str, Any]:
    tabs_result = list_tabs(cdp_url)
    if not tabs_result["ok"]:
        return tabs_result
    
    tabs = tabs_result["tabs"]
    for tab in tabs:
        if tab.get("type") == "page" and tab.get("title"):
            return {"ok": True, "active_tab": tab}
    return {"ok": False, "error": "No active tab found"}
