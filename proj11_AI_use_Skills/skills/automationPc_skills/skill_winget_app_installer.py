import json
import subprocess
from typing import List, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_winget_app_installer",
    "risk_level": "confirm",
    "description": "Search packages, list installed apps, check available upgrades via Windows winget CLI, and generate safe install/upgrade commands. Tìm phần mềm winget, kiểm tra phần mềm cần cập nhật trên Windows, xuất danh sách app đã cài",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["search_package", "list_upgrades", "build_install_cmd"]
            },
            "query": {
                "type": "string",
                "description": "The search query for packages."
            },
            "package_id": {
                "type": "string",
                "description": "The package ID for installation or upgrade."
            },
            "dry_run": {
                "type": "boolean",
                "description": "If true, do not execute the command, just return the preview.",
                "default": True
            }
        },
        "required": ["action"]
    }
}

def execute(action: str = "search_package", **kwargs) -> Dict[str, Any]:
    if action == "search_package":
        return search_package(query=kwargs.get("query", ""), dry_run=kwargs.get("dry_run", True))
    elif action == "list_upgrades":
        return list_upgrades(dry_run=kwargs.get("dry_run", True))
    elif action == "build_install_cmd":
        return build_install_cmd(package_id=kwargs.get("package_id", ""), dry_run=kwargs.get("dry_run", True))
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def search_package(query: str, dry_run: bool = True) -> Dict[str, Any]:
    try:
        import subprocess
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    
    try:
        result = subprocess.run(["winget", "search", query], capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
        if dry_run:
            return {"ok": True, "preview": result.stdout}
        else:
            return {"ok": True, "result": result.stdout}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": str(e)}

def list_upgrades(dry_run: bool = True) -> Dict[str, Any]:
    try:
        import subprocess
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    
    try:
        result = subprocess.run(["winget", "upgrade", "--list"], capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
        if dry_run:
            return {"ok": True, "preview": result.stdout}
        else:
            return {"ok": True, "result": result.stdout}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": str(e)}

def build_install_cmd(package_id: str, dry_run: bool = True) -> Dict[str, Any]:
    try:
        import subprocess
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    
    cmd = f"winget install {package_id}"
    if dry_run:
        return {"ok": True, "preview": cmd}
    else:
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
            return {"ok": True, "result": result.stdout}
        except subprocess.CalledProcessError as e:
            return {"ok": False, "error": str(e)}
