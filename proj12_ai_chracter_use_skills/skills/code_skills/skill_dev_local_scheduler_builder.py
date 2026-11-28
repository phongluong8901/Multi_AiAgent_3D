import os
import json
import subprocess
import pathlib

TOOL_SCHEMA = {
    "name": "skill_dev_local_scheduler_builder",
    "description": "Tạo tool PC và Linux lên lịch chạy tự động định kỳ check thời tiết check giá chạy skill, sinh cấu hình tự khởi động Windows Task Scheduler và systemd. Create a tool for PC and Linux to automatically schedule periodic tasks to check weather, prices, or run skills, and generate startup configurations for Windows Task Scheduler or systemd.",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["validate_schedule_spec", "generate_scheduler_script", "generate_os_autostart"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str = None) -> str:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def validate_schedule_spec(jobs: list[dict]) -> bool:
    for job in jobs:
        if not all(key in job for key in ["name", "interval", "command"]):
            return False
    return True

def generate_scheduler_script(jobs: list[dict], output_path: str = 'scheduler_app.py', dry_run: bool = True) -> None:
    script_content = """import time
import subprocess

def run_job(command):
    subprocess.run(command, shell=True)

if __name__ == "__main__":
"""
    for job in jobs:
        script_content += f"    while True:\n"
        script_content += f"        run_job('{job['command']}')\n"
        script_content += f"        time.sleep({job['interval']})\n"

    if not dry_run:
        with open(output_path, 'w') as f:
            f.write(script_content)

def generate_os_autostart(app_cmd: str, target_os: str = 'windows', name: str = 'AutoTool') -> str:
    if target_os == 'windows':
        return f'schtasks /create /tn "{name}" /tr "{app_cmd}" /sc minute /mo 1'
    elif target_os == 'linux':
        return f'echo "[Unit]\\nDescription={name}\\n\\n[Service]\\nExecStart={app_cmd}\\n\\n[Install]\\nWantedBy=multi-user.target" > /etc/systemd/system/{name}.service'
    else:
        return f"Unsupported OS: {target_os}"

def execute(action: str, **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}

    if action == "validate_schedule_spec":
        jobs = kwargs.get("jobs", [])
        return {"ok": True, "valid": validate_schedule_spec(jobs)}

    if action == "generate_scheduler_script":
        jobs = kwargs.get("jobs", [])
        output_path = kwargs.get("output_path", "scheduler_app.py")
        dry_run = kwargs.get("dry_run", True)
        generate_scheduler_script(jobs, output_path, dry_run)
        return {"ok": True, "output_path": output_path}

    if action == "generate_os_autostart":
        app_cmd = kwargs.get("app_cmd", "")
        target_os = kwargs.get("target_os", "windows")
        name = kwargs.get("name", "AutoTool")
        return {"ok": True, "command": generate_os_autostart(app_cmd, target_os, name)}

    return {"ok": False, "error": "Invalid action parameters"}
