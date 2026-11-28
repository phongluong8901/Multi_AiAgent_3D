import ast
import json
import subprocess
from pathlib import Path

TOOL_SCHEMA = {
    "name": "skill_dev_syntax_lint_checker",
    "description": "Check code syntax locally: validate Python files via ast.parse returning exact line/col errors, validate JSON config files via json.loads, and build/run language-specific syntax checks (python, node, rust) via mockable _run_cmd (dry_run=True default).",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["check_python_syntax", "check_json_file", "run_language_check"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str = None) -> str:
    if cwd:
        result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=False)
    else:
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    return result.stdout

def check_python_syntax(file_path: str) -> dict:
    try:
        with open(file_path, 'r') as file:
            content = file.read()
        ast.parse(content)
        return {"ok": True, "message": "Python syntax is valid."}
    except SyntaxError as e:
        return {"ok": False, "error": f"Syntax error at line {e.lineno}, column {e.offset}: {e.msg}"}

def check_json_file(file_path: str) -> dict:
    try:
        with open(file_path, 'r') as file:
            json.load(file)
        return {"ok": True, "message": "JSON file is valid."}
    except json.JSONDecodeError as e:
        return {"ok": False, "error": f"JSON decode error: {e.msg} at line {e.lineno}, column {e.colno}"}

def run_language_check(file_path: str, lang: str = 'python', dry_run: bool = True) -> dict:
    if lang not in ['python', 'node', 'rust']:
        return {"ok": False, "error": f"Unsupported language: {lang}"}
    
    if lang == 'python':
        cmd = ['flake8', file_path]
    elif lang == 'node':
        cmd = ['eslint', file_path]
    elif lang == 'rust':
        cmd = ['cargo', 'check', '--manifest-path', file_path]
    
    if dry_run:
        return {"ok": True, "message": "Dry run output"}  # Thay đổi dòng này
    
    output = _run_cmd(cmd)
    if output:
        return {"ok": False, "error": output}
    return {"ok": True, "message": f"Syntax check passed for {lang}."}

def execute(action: str, **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    if action == "check_python_syntax":
        return check_python_syntax(kwargs.get("file_path", ""))
    elif action == "check_json_file":
        return check_json_file(kwargs.get("file_path", ""))
    elif action == "run_language_check":
        return run_language_check(kwargs.get("file_path", ""), kwargs.get("lang", "python"), kwargs.get("dry_run", True))
