import os
import json
import tempfile
import shutil
import pathlib
import subprocess
import jsonschema  # Added import for jsonschema
from typing import List, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_dev_desktop_tray_app_builder",
    "description": "Generate compact cross-platform desktop mini-apps using Python stdlib `tkinter`: a quick-launch skill panel reading actions from JSON, a mini status/weather/price widget script, and validated JSON widget config files (dry_run=True default). Tạo mini app giao diện máy tính desktop widget Tkinter Python gọn nhẹ, bảng bấm chạy nhanh skill, widget xem thời tiết giá cả trên PC.",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["generate_desktop_widget_py", "scaffold_desktop_app", "validate_widget_config"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: List[str], cwd: str = None) -> str:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def _http_get(url: str, timeout: float = 3.0) -> str:
    import urllib.request
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return response.read().decode('utf-8')

def validate_widget_config(config: Dict[str, Any]) -> bool:
    schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "buttons": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {"type": "string"},
                        "command": {"type": "string"}
                    },
                    "required": ["label", "command"]
                }
            },
            "refresh_sec": {"type": "integer"}
        },
        "required": ["title", "buttons"]
    }
    try:
        json.dumps(config, indent=2)
        jsonschema.validate(instance=config, schema=schema)
        return True
    except (json.JSONDecodeError, jsonschema.exceptions.ValidationError):
        return False

def generate_desktop_widget_py(title: str, buttons: List[Dict[str, str]], refresh_sec: int = 60, dry_run: bool = True) -> str:
    code = f"""import tkinter as tk
import time

def update():
    # Update logic here
    root.after({refresh_sec}000, update)

root = tk.Tk()
root.title("{title}")

for button in {json.dumps(buttons)}:
    tk.Button(root, text=button['label'], command=lambda cmd=button['command']: eval(cmd)).pack()

update()
root.mainloop()
"""
    if not dry_run:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".py") as temp:
            temp.write(code.encode('utf-8'))
            return temp.name
    return code

def scaffold_desktop_app(project_dir: str, app_name: str, buttons: List[Dict[str, str]], dry_run: bool = True) -> str:
    project_path = pathlib.Path(project_dir) / app_name
    if not dry_run:
        project_path.mkdir(parents=True, exist_ok=True)
        with open(project_path / "main.py", "w") as main_file:
            main_file.write(generate_desktop_widget_py(app_name, buttons, dry_run=False))
        with open(project_path / "README.md", "w") as readme_file:
            readme_file.write(f"# {app_name}\nA simple desktop app.")
    return str(project_path)

def execute(action: str, **kwargs) -> Dict[str, Any]:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    if action == "generate_desktop_widget_py":
        return {"ok": True, "result": generate_desktop_widget_py(**kwargs)}
    elif action == "scaffold_desktop_app":
        return {"ok": True, "result": scaffold_desktop_app(**kwargs)}
    elif action == "validate_widget_config":
        return {"ok": True, "result": validate_widget_config(kwargs["config"])}
    return {"ok": False, "error": "Unexpected error"}
