import json
import requests
from typing import List, Dict

TOOL_SCHEMA = {
    "name": "skill_chrome_tab_workspace",
    "description": "Manage Chrome/Edge tabs over CDP (http://localhost:9222): list/filter tabs, find and deduplicate duplicate URLs, close tabs by domain (dry_run=True), and save/restore tab sessions to a JSON file.",
    "risk_level": "confirm",
    "parameters": {
        "deduplicate_tabs": {
            "description": "Deduplicate tabs based on URL.",
            "parameters": {
                "tabs": "List of tab dictionaries."
            }
        },
        "filter_tabs_by_domain": {
            "description": "Filter tabs by domain.",
            "parameters": {
                "tabs": "List of tab dictionaries.",
                "domain": "Domain to filter by."
            }
        },
        "save_session": {
            "description": "Save tab session to a JSON file.",
            "parameters": {
                "tabs": "List of tab dictionaries.",
                "file_path": "Path to save the session file."
            }
        },
        "load_session": {
            "description": "Load tab session from a JSON file.",
            "parameters": {
                "file_path": "Path to the session file."
            }
        },
        "close_tabs_by_domain": {
            "description": "Close tabs by domain.",
            "parameters": {
                "domain": "Domain to close tabs by.",
                "cdp_url": "CDP URL.",
                "dry_run": "If True, do not actually close tabs."
            }
        }
    }
}

def _fetch_raw(url: str) -> Dict:
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        return {"ok": False, "error": str(e)}

def _save_file(data: List[Dict], file_path: str) -> Dict:
    try:
        with open(file_path, 'w') as f:
            json.dump(data, f)
        return {"ok": True}
    except IOError as e:
        return {"ok": False, "error": str(e)}

def _load_file(file_path: str) -> Dict:
    try:
        with open(file_path, 'r') as f:
            return {"ok": True, "data": json.load(f)}
    except IOError as e:
        return {"ok": False, "error": str(e)}

def deduplicate_tabs(tabs: List[Dict]) -> List[Dict]:
    seen_urls = set()
    unique_tabs = []
    for tab in tabs:
        if tab['url'] not in seen_urls:
            unique_tabs.append(tab)
            seen_urls.add(tab['url'])
    return unique_tabs

def filter_tabs_by_domain(tabs: List[Dict], domain: str) -> List[Dict]:
    return [tab for tab in tabs if domain in tab['url']]

def save_session(tabs: List[Dict], file_path: str = 'chrome_session.json') -> Dict:
    return _save_file(tabs, file_path)

def load_session(file_path: str = 'chrome_session.json') -> Dict:
    return _load_file(file_path)

def close_tabs_by_domain(domain: str, cdp_url: str = 'http://localhost:9222', dry_run: bool = True) -> Dict:
    try:
        browser_tabs = _fetch_raw(f"{cdp_url}/json")
        if "error" in browser_tabs:
            return browser_tabs

        tabs_to_close = [tab for tab in browser_tabs if domain in tab['url']]
        if dry_run:
            return {"ok": True, "dry_run": True, "tabs_to_close": tabs_to_close}

        for tab in tabs_to_close:
            close_result = _fetch_raw(tab['closeUrl'])
            if not close_result.get("ok"):
                return {"ok": False, "error": f"Failed to close tab {tab['id']}"}
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def execute(action: str = "deduplicate_tabs", **kwargs) -> Dict:
    if action == "deduplicate_tabs":
        tabs = kwargs.get("tabs", [])
        return {"ok": True, "data": deduplicate_tabs(tabs)}
    elif action == "filter_tabs_by_domain":
        tabs = kwargs.get("tabs", [])
        domain = kwargs.get("domain", "")
        return {"ok": True, "data": filter_tabs_by_domain(tabs, domain)}
    elif action == "save_session":
        tabs = kwargs.get("tabs", [])
        file_path = kwargs.get("file_path", "chrome_session.json")
        return save_session(tabs, file_path)
    elif action == "load_session":
        file_path = kwargs.get("file_path", "chrome_session.json")
        return load_session(file_path)
    elif action == "close_tabs_by_domain":
        domain = kwargs.get("domain", "")
        cdp_url = kwargs.get("cdp_url", "http://localhost:9222")
        dry_run = kwargs.get("dry_run", True)
        return close_tabs_by_domain(domain, cdp_url, dry_run)
    else:
        return {"ok": False, "error": "Unknown action"}
