import os
import socket
import subprocess
import urllib.request
import json

TOOL_SCHEMA = {
    "name": "skill_dev_local_preview_runner",
    "description": "Find an available localhost TCP port in a range, build clean startup commands for local dev servers (fastapi, static_http, node, rust), and probe preview URL health via mockable _http_get.",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["find_free_port", "build_launch_command", "check_preview_health"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str = None) -> str:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def _http_get(url: str, timeout: float = 3.0) -> str:
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return response.read().decode()

def find_free_port(start_port: int = 8000, end_port: int = 8999) -> int:
    for port in range(start_port, end_port + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
    raise RuntimeError("No free port found in the specified range")

def build_launch_command(project_dir: str, stack: str = 'fastapi', port: int = 8000) -> str:
    if stack == 'fastapi':
        return f"uvicorn main:app --host 0.0.0.0 --port {port}"
    elif stack == 'static_http':
        return f"python -m http.server {port} --directory {project_dir}"
    elif stack == 'node':
        return f"node server.js --port {port}"
    elif stack == 'rust':
        return f"cargo run -- --port {port}"
    else:
        raise ValueError(f"Unsupported stack: {stack}")

def check_preview_health(url: str, timeout: float = 3.0) -> bool:
    try:
        _http_get(url, timeout)
        return True
    except Exception:
        return False

def execute(action: str, **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    try:
        if action == "find_free_port":
            port = find_free_port(**kwargs)
            return {"ok": True, "port": port}
        elif action == "build_launch_command":
            command = build_launch_command(**kwargs)
            return {"ok": True, "command": command}
        elif action == "check_preview_health":
            is_healthy = check_preview_health(**kwargs)
            return {"ok": True, "is_healthy": is_healthy}
    except Exception as e:
        return {"ok": False, "error": str(e)}

    return {"ok": False, "error": "Unexpected error"}
