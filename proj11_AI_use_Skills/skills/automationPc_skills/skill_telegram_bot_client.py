import os
import json
import urllib.request
from urllib.error import URLError

TOOL_SCHEMA = {
    "name": "skill_telegram_bot_client",
    "description": "Interact with Telegram Bot API using TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars (urllib.request helper): send text/Markdown messages, send documents, and fetch recent updates.",
    "risk_level": "confirm",
    "parameters": {
        "actions": {
            "send_message": {
                "description": "Send a text/Markdown message to a Telegram chat.",
                "parameters": {
                    "text": "The message text to send.",
                    "chat_id": "The chat ID to send the message to. Defaults to TELEGRAM_CHAT_ID env var.",
                    "parse_mode": "The parse mode for the message. Defaults to 'Markdown'.",
                    "dry_run": "If True, do not actually send the message. Defaults to True."
                }
            },
            "send_document": {
                "description": "Send a document to a Telegram chat.",
                "parameters": {
                    "file_path": "The path to the file to send.",
                    "caption": "The caption for the document. Defaults to an empty string.",
                    "chat_id": "The chat ID to send the document to. Defaults to TELEGRAM_CHAT_ID env var.",
                    "dry_run": "If True, do not actually send the document. Defaults to True."
                }
            },
            "get_updates": {
                "description": "Fetch recent updates from the Telegram Bot API.",
                "parameters": {
                    "limit": "The maximum number of updates to fetch. Defaults to 10."
                }
            }
        }
    }
}

def _fetch_raw(url, data=None):
    try:
        if data:
            data = data.encode('utf-8')
        request = urllib.request.Request(url, data=data)
        with urllib.request.urlopen(request) as response:
            return response.read().decode('utf-8')
    except URLError as e:
        return {"ok": False, "error": f"URLError: {e.reason}"}
    except Exception as e:
        return {"ok": False, "error": f"Unexpected error: {str(e)}"}

def send_message(text: str, chat_id: str='', parse_mode: str='Markdown', dry_run: bool=True) -> dict:
    token = os.getenv('TELEGRAM_BOT_TOKEN')
    if not token:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN environment variable not set"}
    
    chat_id = chat_id or os.getenv('TELEGRAM_CHAT_ID')
    if not chat_id:
        return {"ok": False, "error": "TELEGRAM_CHAT_ID environment variable not set"}
    
    if dry_run:
        return {"ok": True, "message": "Dry run: Message not sent"}
    
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = json.dumps({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode
    })
    return _fetch_raw(url, data)

def send_document(file_path: str, caption: str='', chat_id: str='', dry_run: bool=True) -> dict:
    token = os.getenv('TELEGRAM_BOT_TOKEN')
    if not token:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN environment variable not set"}
    
    chat_id = chat_id or os.getenv('TELEGRAM_CHAT_ID')
    if not chat_id:
        return {"ok": False, "error": "TELEGRAM_CHAT_ID environment variable not set"}
    
    if dry_run:
        return {"ok": True, "message": "Dry run: Document not sent"}
    
    try:
        with open(file_path, 'rb') as file:
            files = {'document': file}
            data = {'chat_id': chat_id, 'caption': caption}
            url = f"https://api.telegram.org/bot{token}/sendDocument"
            request = urllib.request.Request(url, data=data, files=files)
            with urllib.request.urlopen(request) as response:
                return json.loads(response.read().decode('utf-8'))
    except FileNotFoundError:
        return {"ok": False, "error": f"File not found: {file_path}"}
    except Exception as e:
        return {"ok": False, "error": f"Unexpected error: {str(e)}"}

def get_updates(limit: int=10) -> dict:
    token = os.getenv('TELEGRAM_BOT_TOKEN')
    if not token:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN environment variable not set"}
    
    url = f"https://api.telegram.org/bot{token}/getUpdates?limit={limit}"
    return json.loads(_fetch_raw(url))

def execute(action: str = "send_message", **kwargs) -> dict:
    if action == "send_message":
        return _safe_call(send_message, kwargs)
    elif action == "send_document":
        return _safe_call(send_document, kwargs)
    elif action == "get_updates":
        return _safe_call(get_updates, kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
