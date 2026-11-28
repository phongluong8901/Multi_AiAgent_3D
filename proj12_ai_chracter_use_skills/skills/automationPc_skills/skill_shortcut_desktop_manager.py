import os
import json
import tempfile
import shutil

TOOL_SCHEMA = {
    "name": "skill_shortcut_desktop_manager",
    "risk_level": "confirm",
    "description": "Tạo shortcut lối tắt trên Desktop, liệt kê icon trên màn hình Desktop, dọn gọn Desktop. Create shortcuts on Desktop, list icons on Desktop, and organize Desktop clutter.",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["list_desktop_items", "create_shortcut", "desktop_summary"]
            },
            "name": {
                "type": "string",
                "description": "Name of the shortcut"
            },
            "target_path": {
                "type": "string",
                "description": "Target path for the shortcut"
            },
            "dry_run": {
                "type": "boolean",
                "description": "If true, perform a dry run without making changes",
                "default": True
            }
        },
        "required": ["action"]
    }
}

def execute(action: str = "list_desktop_items", **kwargs) -> dict:
    if action == "list_desktop_items":
        return list_desktop_items()
    elif action == "create_shortcut":
        name = kwargs.get("name")
        target_path = kwargs.get("target_path")
        dry_run = kwargs.get("dry_run", True)
        return create_shortcut(name, target_path, dry_run)
    elif action == "desktop_summary":
        return desktop_summary()
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def list_desktop_items() -> dict:
    try:
        import os
        desktop_path = os.path.join(os.path.expanduser("~"), "Desktop")
        items = os.listdir(desktop_path)
        return {"ok": True, "items": items}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def create_shortcut(name: str, target_path: str, dry_run: bool = True) -> dict:
    try:
        import os
        import tempfile
        import shutil
        from win32com.client import Dispatch
    except ImportError as e:
        return {"ok": False, "error": f"Missing package: {str(e)}"}

    if not name or not target_path:
        return {"ok": False, "error": "Name and target_path are required"}

    desktop_path = os.path.join(os.path.expanduser("~"), "Desktop")
    shortcut_path = os.path.join(desktop_path, f"{name}.lnk")

    if dry_run:
        return {"ok": True, "preview": f"Would create shortcut '{name}' pointing to '{target_path}' at '{shortcut_path}'"}

    try:
        shell = Dispatch('WScript.Shell')
        shortcut = shell.CreateShortCut(shortcut_path)
        shortcut.Targetpath = target_path
        shortcut.Save()
        return {"ok": True, "message": f"Shortcut '{name}' created successfully"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def desktop_summary() -> dict:
    try:
        import os
        desktop_path = os.path.join(os.path.expanduser("~"), "Desktop")
        items = os.listdir(desktop_path)
        summary = {
            "total_items": len(items),
            "items": items
        }
        return {"ok": True, "summary": summary}
    except Exception as e:
        return {"ok": False, "error": str(e)}
