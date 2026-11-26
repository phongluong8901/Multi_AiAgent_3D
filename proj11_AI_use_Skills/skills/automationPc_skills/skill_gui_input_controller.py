import json

TOOL_SCHEMA = {
    "name": "skill_gui_input_controller",
    "risk_level": "confirm",
    "description": "Control mouse click/drag/scroll, hotkeys, and reliable Vietnamese Unicode typing via clipboard paste (pyautogui/pyperclip lazy-imported). bấm chuột click tọa độ, gõ phím tiếng Việt Unicode, tổ hợp phím tắt hotkey, cuộn trang scroll, kéo thả",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["click", "type_unicode", "press_hotkey", "scroll"]
            },
            "x": {
                "type": "integer",
                "default": 0
            },
            "y": {
                "type": "integer",
                "default": 0
            },
            "button": {
                "type": "string",
                "default": "left"
            },
            "clicks": {
                "type": "integer",
                "default": 1
            },
            "text": {
                "type": "string",
                "default": ""
            },
            "keys": {
                "type": "array",
                "items": {
                    "type": "string"
                },
                "default": []
            },
            "amount": {
                "type": "integer",
                "default": -300
            },
            "dry_run": {
                "type": "boolean",
                "default": False
            }
        },
        "required": ["action"]
    }
}

def execute(action: str = "", **kwargs) -> dict:
    dry_run = kwargs.get("dry_run", False)
    
    if action == "click":
        x = kwargs.get("x", 0)
        y = kwargs.get("y", 0)
        button = kwargs.get("button", "left")
        clicks = kwargs.get("clicks", 1)
        return click(x, y, button, clicks, dry_run)
    
    elif action == "type_unicode":
        text = kwargs.get("text", "")
        return type_unicode(text, dry_run)
    
    elif action == "press_hotkey":
        keys = kwargs.get("keys", [])
        return press_hotkey(keys, dry_run)
    
    elif action == "scroll":
        amount = kwargs.get("amount", -300)
        return scroll(amount, dry_run)
    
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def click(x: int, y: int, button: str, clicks: int, dry_run: bool) -> dict:
    if dry_run:
        return {"ok": True, "preview": f"Click at ({x}, {y}) with button '{button}' {clicks} times"}
    
    try:
        import pyautogui
    except ImportError:
        return {"ok": False, "error": "Missing package pyautogui"}
    
    try:
        pyautogui.click(x, y, clicks=clicks, button=button)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def type_unicode(text: str, dry_run: bool) -> dict:
    if dry_run:
        return {"ok": True, "preview": f"Type Unicode text: {text}"}
    
    try:
        import pyperclip
        import pyautogui
    except ImportError:
        return {"ok": False, "error": "Missing package pyperclip or pyautogui"}
    
    try:
        pyperclip.copy(text)
        pyautogui.hotkey('ctrl', 'v')
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def press_hotkey(keys: list[str], dry_run: bool) -> dict:
    if dry_run:
        return {"ok": True, "preview": f"Press hotkey: {' + '.join(keys)}"}
    
    try:
        import pyautogui
    except ImportError:
        return {"ok": False, "error": "Missing package pyautogui"}
    
    try:
        pyautogui.hotkey(*keys)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def scroll(amount: int, dry_run: bool) -> dict:
    if dry_run:
        return {"ok": True, "preview": f"Scroll by {amount} units"}
    
    try:
        import pyautogui
    except ImportError:
        return {"ok": False, "error": "Missing package pyautogui"}
    
    try:
        pyautogui.scroll(amount)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}
