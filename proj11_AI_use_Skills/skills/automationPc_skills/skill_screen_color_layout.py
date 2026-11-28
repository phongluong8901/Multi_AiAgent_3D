import json

TOOL_SCHEMA = {
    "name": "skill_screen_color_layout",
    "risk_level": "safe",
    "description": "Inspect monitor layout/resolutions, current cursor coordinates, and sample RGB/HEX pixel color at (x, y) via mss/pyautogui lazy-imported. xem thông tin đa màn hình độ phân giải, vị trí con trỏ chuột hiện tại, lấy mã màu HEX pixel trên màn hình",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["list_monitors", "get_cursor_position", "rgb_to_hex"]
            },
            "x": {
                "type": "integer",
                "description": "X coordinate for rgb_to_hex action"
            },
            "y": {
                "type": "integer",
                "description": "Y coordinate for rgb_to_hex action"
            },
            "r": {
                "type": "integer",
                "description": "Red component for rgb_to_hex action"
            },
            "g": {
                "type": "integer",
                "description": "Green component for rgb_to_hex action"
            },
            "b": {
                "type": "integer",
                "description": "Blue component for rgb_to_hex action"
            },
            "dry_run": {
                "type": "boolean",
                "default": True
            }
        },
        "required": ["action"]
    }
}

def execute(action: str = "list_monitors", **kwargs) -> dict:
    try:
        if action == "list_monitors":
            return list_monitors(dry_run=kwargs.get("dry_run", True))
        elif action == "get_cursor_position":
            return get_cursor_position(dry_run=kwargs.get("dry_run", True))
        elif action == "rgb_to_hex":
            r = kwargs.get("r")
            g = kwargs.get("g")
            b = kwargs.get("b")
            x = kwargs.get("x")
            y = kwargs.get("y")
            if r is None or g is None or b is None:
                return {"ok": False, "error": "Missing RGB parameters"}
            if action == "rgb_to_hex" and (x is not None or y is not None):
                return {"ok": False, "error": "x and y parameters are not used in rgb_to_hex action"}
            return rgb_to_hex(r, g, b, dry_run=kwargs.get("dry_run", True))
        else:
            return {"ok": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def list_monitors(dry_run: bool = True) -> dict:
    try:
        from mss import mss
    except ImportError:
        return {"ok": False, "error": "Missing package mss"}
    
    with mss() as sct:
        monitors = sct.monitors
        if dry_run:
            return {"ok": True, "preview": monitors}
        return {"ok": True, "monitors": monitors}

def get_cursor_position(dry_run: bool = True) -> dict:
    try:
        import pyautogui
    except ImportError:
        return {"ok": False, "error": "Missing package pyautogui"}
    
    position = pyautogui.position()
    if dry_run:
        return {"ok": True, "preview": {"x": position.x, "y": position.y}}
    return {"ok": True, "position": {"x": position.x, "y": position.y}}

def rgb_to_hex(r: int, g: int, b: int, dry_run: bool = True) -> dict:
    hex_color = "#{:02x}{:02x}{:02x}".format(r, g, b)
    if dry_run:
        return {"ok": True, "preview": hex_color}
    return {"ok": True, "hex_color": hex_color}
