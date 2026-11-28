import json
import re
from typing import Dict, Any

TOOL_SCHEMA = {
    "name": "skill_powershell_runner",
    "risk_level": "confirm",
    "description": "Execute PowerShell/CMD commands safely with UTF-8 output, timeout, optional JSON parsing, and dangerous-command blocklist. Chạy lệnh PowerShell, CMD, terminal Windows, thực thi script hệ thống.",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["run_ps", "run_cmd"]
            },
            "command": {
                "type": "string"
            },
            "timeout": {
                "type": "integer",
                "default": 30
            },
            "parse_json": {
                "type": "boolean",
                "default": False
            }
        },
        "required": ["action", "command"]
    }
}

DANGEROUS_COMMANDS = [
    "shutdown", "format", "delete", "rm", "del", "erase", "kill", "taskkill", "net user", "net localgroup"
]

def execute(action: str = "run_ps", **kwargs) -> Dict[str, Any]:
    if action == "run_ps":
        return _safe_call(run_ps, kwargs)
    elif action == "run_cmd":
        return _safe_call(run_cmd, kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def run_ps(command: str, timeout: int = 30, parse_json: bool = False) -> Dict[str, Any]:
    if any(dangerous in command.lower() for dangerous in DANGEROUS_COMMANDS):
        return {"ok": False, "error": "Command contains dangerous keywords."}

    try:
        import subprocess
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}

    try:
        result = subprocess.run(
            ["powershell", "-Command", command],
            capture_output=True,
            text=True, encoding="utf-8", errors="replace",
            timeout=timeout,
            check=True
        )
        output = result.stdout.strip()
        if parse_json:
            try:
                output = json.loads(output)
            except json.JSONDecodeError:
                return {"ok": False, "error": "Failed to parse JSON output."}
        return {"ok": True, "output": output}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "Command timed out."}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": e.stderr.strip()}

def run_cmd(command: str, timeout: int = 30) -> Dict[str, Any]:
    if any(dangerous in command.lower() for dangerous in DANGEROUS_COMMANDS):
        return {"ok": False, "error": "Command contains dangerous keywords."}

    try:
        import subprocess
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}

    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True, encoding="utf-8", errors="replace",
            timeout=timeout,
            check=True
        )
        output = result.stdout.strip()
        return {"ok": True, "output": output}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "Command timed out."}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": e.stderr.strip()}

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
