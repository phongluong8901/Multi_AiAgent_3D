import os
import re
import ast
import json
import shlex
import difflib
import pathlib
import subprocess
import urllib.request

TOOL_SCHEMA = {
    "name": "skill_dev_webhook_bot_builder",
    "description": "Tạo bot điều khiển qua Telegram Discord Webhook, định tuyến lệnh slash command /status /price /run gọi lại các skill AutoEvolve. Create a bot controller via Telegram, Discord Webhook, routing slash commands (/status /price /run) to call AutoEvolve skills.",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["parse_bot_command", "validate_command_routes", "generate_webhook_bot_py"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str = None) -> str:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def _http_get(url: str, timeout: float = 3.0) -> str:
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return response.read().decode('utf-8')

def parse_bot_command(text: str) -> dict:
    try:
        parts = shlex.split(text)
    except ValueError:
        parts = text.split()
    
    command = parts[0]
    args = []
    kwargs = {}
    
    for part in parts[1:]:
        if '=' in part:
            key, value = part.split('=', 1)
            kwargs[key] = value
        else:
            args.append(part)
    
    return {"command": command, "args": args, "kwargs": kwargs}

def validate_command_routes(routes: dict) -> bool:
    if not isinstance(routes, dict):
        return False
    for cmd, route in routes.items():
        if not isinstance(cmd, str) or not isinstance(route, str):
            return False
    return True

def generate_webhook_bot_py(platform: str = 'telegram', routes: dict = None, bridge_url: str = 'http://127.0.0.1:8765', output_path: str = 'bot_runner.py', dry_run: bool = False) -> bool:
    if not validate_command_routes(routes):
        return False
    
    template = f"""
import os
import json
import urllib.request

BRIDGE_URL = '{bridge_url}'

def handle_command(command, args, kwargs):
    data = {{'command': command, 'args': args, 'kwargs': kwargs}}
    req = urllib.request.Request(BRIDGE_URL, data=json.dumps(data).encode('utf-8'), headers={{'Content-Type': 'application/json'}})
    with urllib.request.urlopen(req) as response:
        return response.read().decode('utf-8')

def main():
    routes = {json.dumps(routes)}
    # Placeholder for webhook handling logic
    print("Webhook bot for {platform} is running...")

if __name__ == "__main__":
    main()
"""
    
    try:
        ast.parse(template)
    except SyntaxError:
        return False
    
    if not dry_run:
        with open(output_path, 'w') as f:
            f.write(template)
    
    return True

def execute(action: str = "parse_bot_command", **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    if action == "parse_bot_command":
        result = parse_bot_command(kwargs.get("text", ""))
        return {"ok": True, "result": result}
    
    if action == "validate_command_routes":
        result = validate_command_routes(kwargs.get("routes", {}))
        return {"ok": True, "result": result}
    
    if action == "generate_webhook_bot_py":
        result = generate_webhook_bot_py(
            platform=kwargs.get("platform", "telegram"),
            routes=kwargs.get("routes", {}),
            bridge_url=kwargs.get("bridge_url", "http://127.0.0.1:8765"),
            output_path=kwargs.get("output_path", "bot_runner.py"),
            dry_run=kwargs.get("dry_run", False)
        )
        return {"ok": True, "result": result}
    
    return {"ok": False, "error": "Unexpected error"}
