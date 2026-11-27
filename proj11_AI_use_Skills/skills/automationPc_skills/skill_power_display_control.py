import json
import subprocess
import time
from typing import Dict, Any

TOOL_SCHEMA = {
    "name": "skill_power_display_control",
    "risk_level": "confirm",
    "description": "Check battery status, get/set screen brightness via PowerShell WMI, switch Windows Power Plan, lock workstation, or schedule shutdown/cancel. (chỉnh độ sáng màn hình, xem phần trăm pin, đổi chế độ nguồn Power Plan, khóa màn hình, hẹn giờ tắt máy ngủ sleep)",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["get_battery", "set_brightness", "lock_screen", "schedule_shutdown", "cancel_shutdown"]
            },
            "level": {
                "type": "integer",
                "minimum": 0,
                "maximum": 100,
                "default": 70
            },
            "minutes": {
                "type": "integer",
                "minimum": 1,
                "default": 30
            },
            "dry_run": {
                "type": "boolean",
                "default": True
            }
        },
        "required": ["action"]
    }
}

def execute(action: str = "get_battery", **kwargs) -> Dict[str, Any]:
    if action == "get_battery":
        return get_battery(**kwargs)
    elif action == "set_brightness":
        return set_brightness(**kwargs)
    elif action == "lock_screen":
        return lock_screen(**kwargs)
    elif action == "schedule_shutdown":
        return schedule_shutdown(**kwargs)
    elif action == "cancel_shutdown":
        return cancel_shutdown(**kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def get_battery(**kwargs) -> Dict[str, Any]:
    try:
        import subprocess
        result = subprocess.run(["powershell", "-Command", "Get-WmiObject -Class Win32_Battery"], capture_output=True, text=True, encoding="utf-8", errors="replace")
        if result.returncode != 0:
            return {"ok": False, "error": "Failed to get battery status"}
        battery_info = result.stdout
        return {"ok": True, "battery_info": battery_info}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}

def set_brightness(level: int = 70, **kwargs) -> Dict[str, Any]:
    try:
        import subprocess
        if level < 0 or level > 100:
            return {"ok": False, "error": "Brightness level must be between 0 and 100"}
        command = f"powershell -Command \"(Get-WmiObject -Namespace root\\wmi -Class WmiMonitorBrightnessMethods).WmiSetBrightness({level}, 0)\""
        if kwargs.get("dry_run", True):
            return {"ok": True, "preview": f"Would set brightness to {level}"}
        result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if result.returncode != 0:
            return {"ok": False, "error": "Failed to set brightness"}
        return {"ok": True, "brightness": level}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}

def lock_screen(**kwargs) -> Dict[str, Any]:
    try:
        import subprocess
        if kwargs.get("dry_run", True):
            return {"ok": True, "preview": "Would lock the screen"}
        subprocess.run(["rundll32.exe", "user32.dll,LockWorkStation"])
        return {"ok": True, "message": "Screen locked"}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}

def schedule_shutdown(minutes: int = 30, **kwargs) -> Dict[str, Any]:
    try:
        import subprocess
        if minutes < 1:
            return {"ok": False, "error": "Minutes must be at least 1"}
        command = f"shutdown -s -t {minutes * 60}"
        if kwargs.get("dry_run", True):
            return {"ok": True, "preview": f"Would schedule shutdown in {minutes} minutes"}
        subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace")
        return {"ok": True, "message": f"Shutdown scheduled in {minutes} minutes"}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}

def cancel_shutdown(**kwargs) -> Dict[str, Any]:
    try:
        import subprocess
        if kwargs.get("dry_run", True):
            return {"ok": True, "preview": "Would cancel shutdown"}
        subprocess.run(["shutdown", "-a"], capture_output=True, text=True, encoding="utf-8", errors="replace")
        return {"ok": True, "message": "Shutdown cancelled"}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
