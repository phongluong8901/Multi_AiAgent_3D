import json
import os
import sys
from typing import List, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_win_registry_startup",
    "description": "Inspect Windows startup entries (HKCU Run key via winreg lazy-imported) and manage user environment variables safely with export/backup support.",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["list_startup_apps", "get_env_vars", "format_startup_report"]
            },
            "prefix": {
                "type": "string",
                "description": "Prefix for environment variables to filter by"
            },
            "entries": {
                "type": "array",
                "items": {
                    "type": "object"
                },
                "description": "List of startup entries for formatting"
            }
        },
        "required": ["action"]
    }
}

def execute(action: str, **kwargs) -> Dict[str, Any]:
    if action == "list_startup_apps":
        return list_startup_apps()
    elif action == "get_env_vars":
        prefix = kwargs.get("prefix", "")
        return get_env_vars(prefix)
    elif action == "format_startup_report":
        entries = kwargs.get("entries", [])
        return format_startup_report(entries)
    else:
        return {"ok": False, "error": "Invalid action"}

def list_startup_apps() -> Dict[str, Any]:
    try:
        import winreg
    except ImportError:
        return {"ok": False, "error": "Missing package winreg"}

    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run")
        startup_apps = []
        i = 0
        while True:
            try:
                name, value, _ = winreg.EnumValue(key, i)
                startup_apps.append({"name": name, "path": value})
                i += 1
            except OSError:
                break
        winreg.CloseKey(key)
        return {"ok": True, "startup_apps": startup_apps}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def get_env_vars(prefix: str = "") -> Dict[str, Any]:
    try:
        env_vars = {k: v for k, v in os.environ.items() if k.startswith(prefix)}
        return {"ok": True, "env_vars": env_vars}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def format_startup_report(entries: List[Dict[str, str]]) -> Dict[str, Any]:
    try:
        report = "\n".join([f"{entry['name']}: {entry['path']}" for entry in entries])
        return {"ok": True, "report": report}
    except Exception as e:
        return {"ok": False, "error": str(e)}
