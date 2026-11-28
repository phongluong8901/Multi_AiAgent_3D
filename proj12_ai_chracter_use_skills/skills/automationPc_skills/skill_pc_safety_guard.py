import json
import re
from typing import List, Dict

TOOL_SCHEMA = {
    "name": "skill_pc_safety_guard",
    "description": "Classify PowerShell commands, file paths, and GUI actions into SAFE, CONFIRM, or BLOCKED before execution; block destructive OS commands (format, System32 deletion, shutdown, iex/irm remote execution).",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["evaluate_command", "evaluate_path", "sanitize_args"]
            },
            "command": {
                "type": "string"
            },
            "path": {
                "type": "string"
            },
            "operation": {
                "type": "string"
            },
            "args": {
                "type": "array",
                "items": {
                    "type": "string"
                }
            }
        },
        "required": ["action"]
    }
}

def execute(action: str, **kwargs) -> Dict[str, bool]:
    if action == "evaluate_command":
        return evaluate_command(kwargs.get("command", ""))
    elif action == "evaluate_path":
        path = kwargs.get("path", "")
        operation = kwargs.get("operation", "")
        return evaluate_path(path, operation)
    elif action == "sanitize_args":
        args = kwargs.get("args", [])
        return sanitize_args(args)
    else:
        return {"ok": False, "error": "Invalid action"}

def evaluate_command(command: str) -> Dict[str, bool]:
    blocked_keywords = ["format", "shutdown", "iex", "irm"]
    if any(keyword in command.lower() for keyword in blocked_keywords):
        return {"ok": False, "risk_level": "blocked", "reason": "Destructive command detected"}
    elif "System32" in command:
        return {"ok": False, "risk_level": "blocked", "reason": "System32 manipulation detected"}
    else:
        return {"ok": True, "risk_level": "safe"}

def evaluate_path(path: str, operation: str) -> Dict[str, bool]:
    if operation.lower() in ["delete", "remove"] and "System32" in path:
        return {"ok": False, "risk_level": "blocked", "reason": "System32 manipulation detected"}
    else:
        return {"ok": True, "risk_level": "safe"}

def sanitize_args(args: List[str]) -> Dict[str, bool]:
    for arg in args:
        if re.search(r'iex|irm', arg, re.IGNORECASE):
            return {"ok": False, "risk_level": "blocked", "reason": "Remote execution detected in arguments"}
    return {"ok": True, "risk_level": "safe"}
