import subprocess

TOOL_SCHEMA = {
    "name": "skill_media_desktop_control",
    "description": "Control Windows media playback keys (play/pause, next, prev via pyautogui/PowerShell), switch Windows Virtual Desktops (Win+Ctrl+Left/Right), and check or toggle Windows Dark/Light theme.",
    "risk_level": "safe",
    "parameters": {
        "action": {
            "type": "string",
            "description": "The action to perform: 'playpause', 'next', 'prev', 'switch_virtual_desktop', 'get_theme_mode', 'set_dark_mode'."
        },
        "command": {
            "type": "string",
            "description": "The media command to execute: 'playpause', 'next', 'prev'."
        },
        "direction": {
            "type": "string",
            "description": "The direction to switch virtual desktops: 'left', 'right'."
        },
        "enabled": {
            "type": "boolean",
            "description": "Whether to enable dark mode or not."
        },
        "dry_run": {
            "type": "boolean",
            "description": "If True, do not execute the action, just simulate it."
        }
    }
}

def _run_cmd(cmd):
    try:
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": f"Command failed: {e.stderr}"}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}

def media_key(command: str = 'playpause', dry_run: bool = True):
    if dry_run:
        return {"ok": True, "message": f"Dry run: Media key {command}"}
    try:
        import pyautogui
    except ImportError:
        return {"ok": False, "error": "Missing package pyautogui"}
    
    if command == 'playpause':
        pyautogui.press('playpause')
    elif command == 'next':
        pyautogui.press('nexttrack')
    elif command == 'prev':
        pyautogui.press('prevtrack')
    else:
        return {"ok": False, "error": "Invalid command"}
    return {"ok": True}

def switch_virtual_desktop(direction: str = 'right', dry_run: bool = True):
    if dry_run:
        return {"ok": True, "message": f"Dry run: Switch virtual desktop {direction}"}
    key_combination = 'left' if direction == 'left' else 'right'
    cmd = f'powershell Send-Keys "^%{key_combination}"'
    return _run_cmd(cmd)

def get_theme_mode():
    cmd = 'powershell (Get-ItemProperty -Path HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize).AppsUseLightTheme'
    result = _run_cmd(cmd)
    if isinstance(result, dict) and not result["ok"]:
        return result
    return {"ok": True, "theme_mode": "light" if result == "1" else "dark"}

def set_dark_mode(enabled: bool = True, dry_run: bool = True):
    if dry_run:
        return {"ok": True, "message": f"Dry run: Set dark mode {enabled}"}
    value = 0 if enabled else 1
    cmd = f'powershell Set-ItemProperty -Path HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize -Name AppsUseLightTheme -Value {value}'
    return _run_cmd(cmd)

def execute(action: str = "playpause", **kwargs) -> dict:
    if action == "playpause":
        return media_key(command=kwargs.get("command", "playpause"), dry_run=kwargs.get("dry_run", True))
    elif action == "next":
        return media_key(command="next", dry_run=kwargs.get("dry_run", True))
    elif action == "prev":
        return media_key(command="prev", dry_run=kwargs.get("dry_run", True))
    elif action == "switch_virtual_desktop":
        return switch_virtual_desktop(direction=kwargs.get("direction", "right"), dry_run=kwargs.get("dry_run", True))
    elif action == "get_theme_mode":
        return get_theme_mode()
    elif action == "set_dark_mode":
        return set_dark_mode(enabled=kwargs.get("enabled", True), dry_run=kwargs.get("dry_run", True))
    else:
        return {"ok": False, "error": "Unknown action"}
