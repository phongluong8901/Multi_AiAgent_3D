import json
from typing import Any, Dict, List

TOOL_SCHEMA = {
    "name": "skill_telegram_web_automator",
    "description": "High-level Telegram Web (web.telegram.org) automation over Chrome CDP: locate chats/channels, read recent messages, and send messages safely (dry_run=True default).",
    "risk_level": "confirm",
    "parameters": {
        "build_telegram_plan": {
            "chat_query": "str",
            "message": "str"
        },
        "send_telegram_web_message": {
            "chat_query": "str",
            "message": "str",
            "cdp_url": "str",
            "dry_run": "bool"
        },
        "read_telegram_web_messages": {
            "chat_query": "str",
            "limit": "int",
            "cdp_url": "str",
            "dry_run": "bool"
        }
    }
}

def _run_cmd(cmd: str) -> Dict[str, Any]:
    try:
        import subprocess
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
        return {"ok": True, "output": result.stdout}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": str(e)}

def _fetch_raw(url: str) -> Dict[str, Any]:
    try:
        import requests
        response = requests.get(url)
        response.raise_for_status()
        return {"ok": True, "data": response.text}
    except ImportError:
        return {"ok": False, "error": "Missing package requests"}
    except requests.RequestException as e:
        return {"ok": False, "error": str(e)}

def build_telegram_plan(chat_query: str, message: str) -> Dict[str, Any]:
    # Placeholder for building a plan
    return {"ok": True, "plan": {"chat_query": chat_query, "message": message}}

def send_telegram_web_message(chat_query: str, message: str, cdp_url: str = 'http://localhost:9222', dry_run: bool = True) -> Dict[str, Any]:
    if dry_run:
        return {"ok": True, "action": "send_message", "chat_query": chat_query, "message": message, "dry_run": True}
    # Placeholder for sending message
    return _run_cmd(f"chrome-cdp-client {cdp_url} send_message {chat_query} {message}")

def read_telegram_web_messages(chat_query: str = '', limit: int = 10, cdp_url: str = 'http://localhost:9222', dry_run: bool = True) -> Dict[str, Any]:
    if dry_run:
        return {"ok": True, "action": "read_messages", "chat_query": chat_query, "limit": limit, "dry_run": True, "messages": ["message1", "message2"]}
    # Placeholder for reading messages
    response = _fetch_raw(f"{cdp_url}/read_messages?chat_query={chat_query}&limit={limit}")
    if response["ok"]:
        return {"ok": True, "messages": json.loads(response["data"])}
    return response

def execute(action: str = "build_telegram_plan", **kwargs) -> Dict[str, Any]:
    if action == "build_telegram_plan":
        return _safe_call(build_telegram_plan, kwargs)
    elif action == "send_telegram_web_message":
        return _safe_call(send_telegram_web_message, kwargs)
    elif action == "read_telegram_web_messages":
        return _safe_call(read_telegram_web_messages, kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
