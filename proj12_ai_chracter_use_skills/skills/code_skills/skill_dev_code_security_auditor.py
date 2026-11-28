import os
import re
import ast
import json
from pathlib import Path

TOOL_SCHEMA = {
    "name": "skill_dev_code_security_auditor",
    "description": "Perform static security and maintainability audits on local codebases: regex scan for hardcoded secrets/tokens, Python AST scan for dangerous calls (`eval`, `exec`, `subprocess(..., shell=True)`), and flag overly long functions exceeding a line threshold.",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["scan_hardcoded_secrets", "audit_python_dangerous_calls", "check_function_complexity"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str = None) -> str:
    import subprocess
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def scan_hardcoded_secrets(root_dir: str) -> list[str]:
    hardcoded_secrets = []
    secret_patterns = [
        r'sk_test_\w{24}',
        r'API_KEY\s*=\s*["\']\w+["\']',
        r'Bearer\s+[\w\-\.]+',
        r'xoxb-\w+-\w+-\w+',
        r'xoxp-\w+-\w+-\w+-\w+',
        r'xoxa-\w+-\w+-\w+-\w+',
        r'xoxr-\w+-\w+-\w+-\w+',
        r'xoxs-\w+-\w+-\w+-\w+',
        r'xapp-\w+-\w+-\w+',
        r'ghp_\w{36}',
        r'ghs_\w{36}',
        r'ghu_\w{36}',
        r'gho_\w{36}',
        r'ghr_\w{36}',
        r'ghep_\w{36}',
        r'ghec_\w{36}',
        r'ghes_\w{36}',
        r'gheo_\w{36}',
        r'ghes_\w{36}',
        r'gheo_\w{36}',
        r'ghec_\w{36}',
        r'ghep_\w{36}',
        r'gheo_\w{36}',
        r'ghec_\w{36}',
        r'ghep_\w{36}',
        r'gheo_\w{36}',
        r'ghec_\w{36}',
        r'ghep_\w{36}',
        r'gheo_\w{36}',
        r'ghec_\w{36}',
        r'ghep_\w{36}',
        r'gheo_\w{36}',
    ]
    secret_regex = re.compile('|'.join(secret_patterns))
    for root, _, files in os.walk(root_dir):
        for file in files:
            if file.endswith(('.py', '.js', '.ts', '.json', '.env')):
                file_path = Path(root) / file
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    matches = secret_regex.findall(content)
                    if matches:
                        hardcoded_secrets.append(str(file_path))
    return hardcoded_secrets

def audit_python_dangerous_calls(file_path: str) -> list[str]:
    dangerous_calls = []
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        tree = ast.parse(f.read(), filename=file_path)
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in ['eval', 'exec']:
                dangerous_calls.append(f"{file_path}:{node.lineno}:{node.col_offset}")
            elif isinstance(node.func, ast.Attribute) and node.func.attr == 'run':
                if isinstance(node.func.value, ast.Name) and node.func.value.id == 'subprocess':
                    if any(kw.arg == 'shell' and isinstance(kw.value, ast.Constant) and kw.value.value is True for kw in node.keywords):
                        dangerous_calls.append(f"{file_path}:{node.lineno}:{node.col_offset}")
                elif isinstance(node.func.value, ast.Attribute) and node.func.value.attr == 'subprocess':
                    if any(kw.arg == 'shell' and isinstance(kw.value, ast.Constant) and kw.value.value is True for kw in node.keywords):
                        dangerous_calls.append(f"{file_path}:{node.lineno}:{node.col_offset}")
    return dangerous_calls

def check_function_complexity(file_path: str, max_lines: int = 60) -> list[str]:
    long_functions = []
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        tree = ast.parse(f.read(), filename=file_path)
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            function_lines = node.end_lineno - node.lineno + 1
            if function_lines > max_lines:
                long_functions.append(f"{file_path}:{node.lineno}:{node.name} ({function_lines} lines)")
    return long_functions

def execute(action: str = "scan_hardcoded_secrets", **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    if action == "scan_hardcoded_secrets":
        root_dir = kwargs.get("root_dir", ".")
        results = scan_hardcoded_secrets(root_dir)
        return {"ok": True, "results": results}
    
    if action == "audit_python_dangerous_calls":
        file_path = kwargs.get("file_path")
        if not file_path:
            return {"ok": False, "error": "file_path is required"}
        results = audit_python_dangerous_calls(file_path)
        return {"ok": True, "results": results}
    
    if action == "check_function_complexity":
        file_path = kwargs.get("file_path")
        max_lines = kwargs.get("max_lines", 60)
        if not file_path:
            return {"ok": False, "error": "file_path is required"}
        results = check_function_complexity(file_path, max_lines)
        return {"ok": True, "results": results}
    
    return {"ok": False, "error": "Unknown action"}
