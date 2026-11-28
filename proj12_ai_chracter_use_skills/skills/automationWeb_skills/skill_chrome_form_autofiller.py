import json
import re
from difflib import SequenceMatcher
from typing import List, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_chrome_form_autofiller",
    "description": "Inspect HTML form fields, map user profile key-values to matching input/textarea/select selectors using fuzzy label/name/placeholder matching, and generate or execute CDP fill plans (dry_run=True default).",
    "risk_level": "confirm",
    "parameters": {
        "action": {
            "type": "string",
            "description": "Action to perform: parse_form_fields, map_data_to_fields, execute_fill_plan"
        },
        "html": {
            "type": "string",
            "description": "HTML content of the form"
        },
        "fields": {
            "type": "array",
            "description": "List of form fields"
        },
        "user_data": {
            "type": "object",
            "description": "User data to map to form fields"
        },
        "plan": {
            "type": "array",
            "description": "Fill plan to execute"
        },
        "cdp_url": {
            "type": "string",
            "description": "CDP URL"
        },
        "submit": {
            "type": "boolean",
            "description": "Whether to submit the form"
        },
        "dry_run": {
            "type": "boolean",
            "description": "Whether to perform a dry run"
        }
    }
}

def _fuzzy_match(text1: str, text2: str) -> float:
    return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()

def parse_form_fields(html: str) -> List[Dict[str, Any]]:
    fields = []
    for match in re.finditer(r'<(input|textarea|select)\s+[^>]*?name=["\'](.*?)["\'][^>]*?>', html, re.IGNORECASE):
        tag, name = match.groups()
        fields.append({"tag": tag, "name": name})
    return fields

def map_data_to_fields(fields: List[Dict[str, Any]], user_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    plan = []
    for field in fields:
        for key, value in user_data.items():
            if _fuzzy_match(field["name"], key) > 0.7:
                plan.append({"field": field, "value": value})
                break
    return plan

def _send_cdp_command(url: str, command: Dict[str, Any]) -> Dict[str, Any]:
    try:
        import httpx
        response = httpx.post(url, json=command)
        response.raise_for_status()
        return response.json()
    except ImportError:
        return {"ok": False, "error": "Missing package httpx"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def execute_fill_plan(plan: List[Dict[str, Any]], cdp_url: str = 'http://localhost:9222', submit: bool = False, dry_run: bool = True) -> Dict[str, Any]:
    if dry_run:
        return {"ok": True, "plan": plan}

    for item in plan:
        command = {
            "method": "Runtime.evaluate",
            "params": {
                "expression": f'document.querySelector(\'[name="{item["field"]["name"]}\').value = "{item["value"]}"'
            }
        }
        result = _send_cdp_command(cdp_url, command)
        if not result["ok"]:
            return result

    if submit:
        command = {
            "method": "Runtime.evaluate",
            "params": {
                "expression": "document.querySelector('form').submit()"
            }
        }
        return _send_cdp_command(cdp_url, command)

    return {"ok": True}

def execute(action: str = "", **kwargs) -> Dict[str, Any]:
    if action == "parse_form_fields":
        return {"ok": True, "fields": parse_form_fields(kwargs.get("html", ""))}
    elif action == "map_data_to_fields":
        return {"ok": True, "plan": map_data_to_fields(kwargs.get("fields", []), kwargs.get("user_data", {}))}
    elif action == "execute_fill_plan":
        return execute_fill_plan(kwargs.get("plan", []), kwargs.get("cdp_url", "http://localhost:9222"), kwargs.get("submit", False), kwargs.get("dry_run", True))
    else:
        return {"ok": False, "error": "Unknown action"}
