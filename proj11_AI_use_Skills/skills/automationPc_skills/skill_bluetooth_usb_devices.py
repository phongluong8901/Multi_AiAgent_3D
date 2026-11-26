import json
import subprocess
from typing import List, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_bluetooth_usb_devices",
    "risk_level": "safe",
    "description": "List connected USB devices, external drives, Bluetooth devices, printers, and webcams via PowerShell Get-PnpDevice / Win32_Printer. liệt kê thiết bị USB, ổ cứng ngoài, chuột bàn phím Bluetooth, máy in, webcam đang kết nối",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["list_usb_devices", "list_bluetooth_devices", "list_printers", "list_external_drives"]
            },
            "dry_run": {
                "type": "boolean",
                "default": True
            }
        },
        "required": ["action"]
    }
}

def execute(action: str = "list_usb_devices", dry_run: bool = True, **kwargs) -> Dict[str, Any]:
    if action == "list_usb_devices":
        return list_usb_devices(dry_run)
    elif action == "list_bluetooth_devices":
        return list_bluetooth_devices(dry_run)
    elif action == "list_printers":
        return list_printers(dry_run)
    elif action == "list_external_drives":
        return list_external_drives(dry_run)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def list_usb_devices(dry_run: bool = True) -> Dict[str, Any]:
    if dry_run:
        return {"ok": True, "preview": "Listing USB devices (dry run)"}
    try:
        import subprocess
        result = subprocess.run(["powershell", "Get-PnpDevice -Class USB"], capture_output=True, text=True, check=True)
        return {"ok": True, "devices": result.stdout.splitlines()}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": str(e)}

def list_bluetooth_devices(dry_run: bool = True) -> Dict[str, Any]:
    if dry_run:
        return {"ok": True, "preview": "Listing Bluetooth devices (dry run)"}
    try:
        import subprocess
        result = subprocess.run(["powershell", "Get-PnpDevice -Class Bluetooth"], capture_output=True, text=True, check=True)
        return {"ok": True, "devices": result.stdout.splitlines()}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": str(e)}

def list_printers(dry_run: bool = True) -> Dict[str, Any]:
    if dry_run:
        return {"ok": True, "preview": "Listing printers (dry run)"}
    try:
        import subprocess
        result = subprocess.run(["powershell", "Get-WmiObject -Class Win32_Printer"], capture_output=True, text=True, check=True)
        return {"ok": True, "printers": result.stdout.splitlines()}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": str(e)}

def list_external_drives(dry_run: bool = True) -> Dict[str, Any]:
    if dry_run:
        return {"ok": True, "preview": "Listing external drives (dry run)"}
    try:
        import subprocess
        result = subprocess.run(["powershell", "Get-PnpDevice -Class DiskDrive"], capture_output=True, text=True, check=True)
        return {"ok": True, "drives": result.stdout.splitlines()}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": str(e)}
