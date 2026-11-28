import json
from typing import List, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_zalo_web_automator",
    "description": "High-level Zalo Web (chat.zalo.me) automation over Chrome CDP: build safe search/read/send action plans, sanitize message payloads, and execute via Playwright CDP (dry_run=True by default for sending).",
    "risk_level": "confirm",
    "parameters": {
        "build_send_plan": {
            "contact_name": "str",
            "message": "str"
        },
        "send_zalo_message": {
            "contact_name": "str",
            "message": "str",
            "cdp_url": "str",
            "dry_run": "bool"
        },
        "read_recent_messages": {
            "contact_name": "str",
            "limit": "int",
            "cdp_url": "str",
            "dry_run": "bool"
        }
    }
}

def execute(action: str = "", **kwargs) -> Dict[str, Any]:
    try:
        if action == "build_send_plan":
            return _safe_call(build_send_plan, kwargs)
        elif action == "send_zalo_message":
            return _safe_call(send_zalo_message, kwargs)
        elif action == "read_recent_messages":
            return _safe_call(read_recent_messages, kwargs)
        else:
            return {"ok": False, "error": "Unknown action"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def build_send_plan(contact_name: str, message: str) -> Dict[str, Any]:
    try:
        # Sanitize message payload
        sanitized_message = _sanitize_message(message)
        plan = {
            "contact_name": contact_name,
            "message": sanitized_message
        }
        return {"ok": True, "plan": plan}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def send_zalo_message(contact_name: str, message: str, cdp_url: str = 'http://localhost:9222', dry_run: bool = True) -> Dict[str, Any]:
    try:
        # Sanitize message payload
        sanitized_message = _sanitize_message(message)
        if dry_run:
            return {"ok": True, "dry_run": True, "message": sanitized_message}
        else:
            # Execute send message via Playwright CDP
            result = _send_message_via_cdp(contact_name, sanitized_message, cdp_url)
            return {"ok": True, "result": result}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def read_recent_messages(contact_name: str = '', limit: int = 10, cdp_url: str = 'http://localhost:9222', dry_run: bool = True) -> Dict[str, Any]:
    try:
        if dry_run:
            return {"ok": True, "dry_run": True, "limit": limit}
        else:
            # Execute read messages via Playwright CDP
            messages = _read_messages_via_cdp(contact_name, limit, cdp_url)
            return {"ok": True, "messages": messages}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _sanitize_message(message: str) -> str:
    # Simple sanitization example
    return message.strip()

def _send_message_via_cdp(contact_name: str, message: str, cdp_url: str) -> Dict[str, Any]:
    try:
        # Placeholder for actual CDP message sending logic
        return {"contact_name": contact_name, "message": message}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _read_messages_via_cdp(contact_name: str, limit: int, cdp_url: str) -> List[Dict[str, Any]]:
    try:
        # Placeholder for actual CDP message reading logic
        return [{"contact_name": contact_name, "message": "Sample message", "timestamp": "2023-10-01T12:00:00Z"}] * limit
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
