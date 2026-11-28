import os
import json
import requests
from typing import List, Dict

TOOL_SCHEMA = {
    "name": "skill_chrome_profile_launcher",
    "description": "Inspect local Chrome/Edge User Data profiles (Local State JSON), check if a CDP port (9222) is live via HTTP /json/version helper, and generate safe Windows launch commands for dedicated automation profiles.",
    "risk_level": "safe",
    "parameters": {
        "list_chrome_profiles": {
            "user_data_dir": "str"
        },
        "check_cdp_status": {
            "port": "int",
            "host": "str"
        },
        "build_launch_command": {
            "port": "int",
            "profile_dir": "str",
            "headless": "bool",
            "browser": "str"
        }
    }
}

def _run_cmd(cmd: str) -> str:
    try:
        import subprocess
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
        return result.stdout
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    except subprocess.CalledProcessError as e:
        return e.stderr

def _fetch_raw(url: str) -> str:
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.text
    except ImportError:
        return {"ok": False, "error": "Missing package requests"}
    except requests.RequestException as e:
        return str(e)

def list_chrome_profiles(user_data_dir: str = '') -> List[str]:
    if not user_data_dir:
        user_data_dir = os.path.expanduser(r"~\AppData\Local\Google\Chrome\User Data")
    profiles = []
    try:
        for entry in os.listdir(user_data_dir):
            profile_path = os.path.join(user_data_dir, entry)
            if os.path.isdir(profile_path) and os.path.exists(os.path.join(profile_path, "Preferences")):
                profiles.append(entry)
    except Exception as e:
        return {"ok": False, "error": str(e)}
    return profiles

def check_cdp_status(port: int = 9222, host: str = '127.0.0.1') -> bool:
    url = f"http://{host}:{port}/json/version"
    response = _fetch_raw(url)
    if isinstance(response, dict) and not response["ok"]:
        return response
    try:
        data = json.loads(response)
        return data.get("Browser") is not None
    except json.JSONDecodeError:
        return {"ok": False, "error": "Invalid JSON response"}

def build_launch_command(port: int = 9222, profile_dir: str = r'C:\ChromeDebugProfile', headless: bool = False, browser: str = 'chrome') -> str:
    args = [
        f'"{browser}.exe"',
        f'--remote-debugging-port={port}',
        f'--user-data-dir="{profile_dir}"'
    ]
    if headless:
        args.append("--headless")
    return ' '.join(args)

def execute(action: str = "", **kwargs) -> Dict:
    if action == "schema":
        return {"ok": True, **TOOL_SCHEMA}
    elif action == "list_chrome_profiles":
        return {"ok": True, "profiles": list_chrome_profiles(**kwargs)}
    elif action == "check_cdp_status":
        return {"ok": True, "status": check_cdp_status(**kwargs)}
    elif action == "build_launch_command":
        return {"ok": True, "command": build_launch_command(**kwargs)}
    else:
        return {"ok": False, "error": "Unknown action"}
