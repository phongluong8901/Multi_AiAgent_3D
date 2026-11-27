import os
import subprocess
from typing import List, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_python_venv_manager",
    "description": "Detect Python virtual environments in a workspace, list installed pip packages, and parse requirements.txt dependencies.",
    "risk_level": "safe",
    "parameters": {
        "action": {
            "type": "string",
            "description": "Action to perform: find_venvs, list_installed_packages, parse_requirements"
        },
        "root": {
            "type": "string",
            "description": "Root directory to search for virtual environments",
            "default": "."
        },
        "limit": {
            "type": "integer",
            "description": "Limit the number of packages listed",
            "default": 50
        },
        "file_path": {
            "type": "string",
            "description": "Path to the requirements.txt file",
            "default": "requirements.txt"
        }
    }
}

def _run_cmd(cmd: str) -> str:
    try:
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        return e.stderr.strip()

def find_venvs(root: str = '.') -> List[str]:
    venvs = []
    for dirpath, dirnames, _ in os.walk(root):
        dirnames[:] = [d for d in dirnames if d.lower() not in {'.git', 'node_modules', '__pycache__', '.venv', 'venv', 'appdata', 'windows', '$recycle.bin', 'programdata'}]
        if 'Scripts' in dirnames and 'Lib' in dirnames:
            venvs.append(dirpath)
    return venvs

def list_installed_packages(limit: int = 50) -> List[str]:
    try:
        output = _run_cmd("pip list --format=freeze")
        packages = output.split('\n')
        return packages[:limit]
    except Exception as e:
        return [f"Error: {str(e)}"]

def parse_requirements(file_path: str = 'requirements.txt') -> List[str]:
    try:
        with open(file_path, 'r') as file:
            return [line.strip() for line in file if line.strip() and not line.startswith('#')]
    except FileNotFoundError:
        return ["Error: File not found"]
    except Exception as e:
        return [f"Error: {str(e)}"]

def execute(action: str = "find_venvs", **kwargs) -> Dict[str, Any]:
    if action == "find_venvs":
        root = kwargs.get("root", ".")
        return {"ok": True, "venvs": find_venvs(root)}
    elif action == "list_installed_packages":
        limit = kwargs.get("limit", 50)
        return {"ok": True, "packages": list_installed_packages(limit)}
    elif action == "parse_requirements":
        file_path = kwargs.get("file_path", "requirements.txt")
        return {"ok": True, "requirements": parse_requirements(file_path)}
    else:
        return {"ok": False, "error": "Unknown action"}
