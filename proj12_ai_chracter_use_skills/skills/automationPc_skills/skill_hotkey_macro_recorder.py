import os
import json
import sys
import types
from typing import List, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_hotkey_macro_recorder",
    "risk_level": "confirm",
    "description": "Chạy chuỗi thao tác tự động macro, lưu kịch bản bấm phím chuột lặp lại theo JSON. Validate, save, load, and dry-run/execute reusable JSON UI action macros (wait, hotkey, click, type_unicode).",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["validate_macro", "save_macro", "run_macro"]
            },
            "steps": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "action": {"type": "string"},
                        "params": {"type": "object"}
                    },
                    "required": ["action", "params"]
                }
            },
            "name": {"type": "string"},
            "store_dir": {"type": "string", "default": "macros"},
            "dry_run": {"type": "boolean", "default": True}
        },
        "required": ["action"]
    }
}

def execute(action: str = "validate_macro", **kwargs) -> Dict[str, Any]:
    if action == "validate_macro":
        return validate_macro(kwargs.get("steps", []))
    elif action == "save_macro":
        return save_macro(kwargs.get("name", ""), kwargs.get("steps", []), kwargs.get("store_dir", "macros"))
    elif action == "run_macro":
        return run_macro(kwargs.get("steps", []), kwargs.get("dry_run", True))
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def validate_macro(steps: List[Dict[str, Any]]) -> Dict[str, Any]:
    valid_actions = {"wait", "hotkey", "click", "type_unicode"}
    for step in steps:
        if step.get("action") not in valid_actions:
            return {"ok": False, "error": f"Invalid action: {step.get('action')}"}
    return {"ok": True}

def save_macro(name: str, steps: List[Dict[str, Any]], store_dir: str = "macros") -> Dict[str, Any]:
    if not name:
        return {"ok": False, "error": "Macro name is required"}
    if not os.path.exists(store_dir):
        os.makedirs(store_dir)
    macro_path = os.path.join(store_dir, f"{name}.json")
    try:
        with open(macro_path, "w") as f:
            json.dump(steps, f, indent=4)
        return {"ok": True, "message": f"Macro saved to {macro_path}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def run_macro(steps: List[Dict[str, Any]], dry_run: bool = True) -> Dict[str, Any]:
    if dry_run:
        preview = []
        for step in steps:
            action = step.get("action")
            params = step.get("params", {})
            preview.append(f"Action: {action}, Params: {params}")
        return {"ok": True, "preview": preview}
    else:
        try:
            import pyautogui
            import time
        except ImportError:
            return {"ok": False, "error": "Missing package pyautogui"}
        
        for step in steps:
            action = step.get("action")
            params = step.get("params", {})
            if action == "wait":
                time.sleep(params.get("seconds", 0))
            elif action == "hotkey":
                pyautogui.hotkey(*params.get("keys", []))
            elif action == "click":
                pyautogui.click(params.get("x", 0), params.get("y", 0))
            elif action == "type_unicode":
                pyautogui.write(params.get("text", ""), interval=params.get("interval", 0.01))
        return {"ok": True, "message": "Macro executed successfully"}
