import os
import re
import subprocess
from pathlib import Path
import json

TOOL_SCHEMA = {
    "name": "skill_dev_test_runner_diag",
    "description": "Automatically detect and run tests using pytest, npm, or cargo test. Parse raw test failure output into compact structured failure summaries. Execute or preview test runs via mockable _run_cmd (dry_run=True default).",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["detect_test_framework", "parse_test_failures", "run_project_tests"]},
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

def detect_test_framework(project_dir: str) -> str:
    markers = {
        "pytest": ["pytest.ini", "conftest.py", "requirements.txt"],
        "npm": ["package.json", "node_modules"],
        "cargo": ["Cargo.toml", "Cargo.lock"]
    }
    for framework, files in markers.items():
        if any(Path(project_dir).joinpath(file).exists() for file in files):
            return framework
    return "unknown"

def parse_test_failures(raw_output: str, lang: str = 'python') -> list[dict]:
    if lang == 'python':
        pattern = re.compile(r'^(?P<file>[\w./-]+):(?P<line>\d+): (?P<error>.+)$', re.MULTILINE)
    elif lang == 'javascript':
        pattern = re.compile(r'^(?P<file>[\w./-]+):(?P<line>\d+):(?P<column>\d+): (?P<error>.+)$', re.MULTILINE)
    elif lang == 'rust':
        pattern = re.compile(r'^(?P<file>[\w./-]+):(?P<line>\d+):(?P<column>\d+): (?P<error>.+)$', re.MULTILINE)
    else:
        return []

    matches = pattern.finditer(raw_output)
    return [{"file": match.group('file'), "line": int(match.group('line')), "error": match.group('error')} for match in matches]

def run_project_tests(project_dir: str, lang: str = 'python', dry_run: bool = True) -> dict:
    framework = detect_test_framework(project_dir)
    if framework == 'pytest':
        cmd = ["pytest"]
    elif framework == 'npm':
        cmd = ["npm", "test"]
    elif framework == 'cargo':
        cmd = ["cargo", "test"]
    else:
        return {"ok": False, "error": "Unknown test framework"}

    if dry_run:
        return {"ok": True, "command": " ".join(cmd), "dry_run": True}

    output = _run_cmd(cmd, cwd=project_dir)
    return {"ok": True, "output": output}

def execute(action: str = "detect_test_framework", **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}

    if action == "detect_test_framework":
        project_dir = kwargs.get("project_dir", "")
        return {"ok": True, "framework": detect_test_framework(project_dir)}

    if action == "parse_test_failures":
        raw_output = kwargs.get("raw_output", "")
        lang = kwargs.get("lang", "python")
        return {"ok": True, "failures": parse_test_failures(raw_output, lang)}

    if action == "run_project_tests":
        project_dir = kwargs.get("project_dir", "")
        lang = kwargs.get("lang", "python")
        dry_run = kwargs.get("dry_run", True)
        return run_project_tests(project_dir, lang, dry_run)

    return {"ok": False, "error": "Unknown action"}
