from typing import List, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_clipboard_manager",
    "description": "Read and write Windows clipboard text safely (pyperclip lazy-imported), maintain a local JSON clipboard history, and search past clipboard entries.",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["get_text", "set_text", "save_history", "search_history"]
            },
            "text": {
                "type": "string"
            },
            "entry": {
                "type": "string"
            },
            "query": {
                "type": "string"
            }
        },
        "required": ["action"]
    }
}

HISTORY_FILE = "clipboard_history.json"

def _load_history() -> List[str]:
    import os
    import json
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r") as file:
            return json.load(file)
    return []

def _save_history(history: List[str]) -> None:
    import json
    with open(HISTORY_FILE, "w") as file:
        json.dump(history, file)

def get_text() -> Dict[str, Any]:
    try:
        import pyperclip
    except ImportError:
        return {"ok": False, "error": "Pyperclip could not find a copy/paste mechanism for your system. For more information, please visit https://pyperclip.readthedocs.io/en/latest/index.html#not-implemented-error\nOn Linux, you can run `sudo apt-get install xclip`, `sudo apt-get install xselect` (on X11) or `sudo apt-get install wl-clipboard` (on Wayland) to install a copy/paste mechanism."}
    try:
        text = pyperclip.paste()
        return {"ok": True, "text": text}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def set_text(text: str) -> Dict[str, Any]:
    try:
        import pyperclip
    except ImportError:
        return {"ok": False, "error": "Pyperclip could not find a copy/paste mechanism for your system. For more information, please visit https://pyperclip.readthedocs.io/en/latest/index.html#not-implemented-error\nOn Linux, you can run `sudo apt-get install xclip`, `sudo apt-get install xselect` (on X11) or `sudo apt-get install wl-clipboard` (on Wayland) to install a copy/paste mechanism."}
    try:
        pyperclip.copy(text)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def save_history(entry: str) -> Dict[str, Any]:
    history = _load_history()
    history.append(entry)
    _save_history(history)
    return {"ok": True}

def search_history(query: str) -> Dict[str, Any]:
    history = _load_history()
    results = [entry for entry in history if query in entry]
    return {"ok": True, "results": results}

def execute(action: str, **kwargs) -> Dict[str, Any]:
    if action == "get_text":
        return get_text()
    elif action == "set_text":
        return set_text(kwargs.get("text", ""))
    elif action == "save_history":
        return save_history(kwargs.get("entry", ""))
    elif action == "search_history":
        return search_history(kwargs.get("query", ""))
    else:
        return {"ok": False, "error": "Invalid action"}
