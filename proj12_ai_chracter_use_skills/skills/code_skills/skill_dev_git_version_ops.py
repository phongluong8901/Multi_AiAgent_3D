import os
import re
import subprocess
from pathlib import Path

TOOL_SCHEMA = {
    "name": "skill_dev_git_version_ops",
    "description": "Quản lý phiên bản Git cho dự án AI tự code, phân tích git status, tạo commit message chuẩn conventional và chạy lệnh git an toàn. Manage Git versions for AI self-code projects, parse git status, generate conventional commit messages, and execute safe git operations (status, diff, commit, branch) via mockable _run_cmd (dry_run=True default).",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["parse_git_status_porcelain", "build_commit_message", "run_git_op"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str = None) -> str:
    """Run a shell command and return the output."""
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def parse_git_status_porcelain(raw_status: str) -> dict:
    """Parse git status --porcelain output into staged, modified, and untracked lists."""
    staged = []
    modified = []
    untracked = []

    for line in raw_status.splitlines():
        code = line[:2]
        path = line[3:]
        if code in ('M ', 'A '):
            staged.append(path)
        elif code in (' M', 'AM'):
            modified.append(path)
        elif code == '??':
            untracked.append(path)

    return {"staged": staged, "modified": modified, "untracked": untracked}

def build_commit_message(change_type: str = 'feat', scope: str = 'app', summary: str = 'update') -> str:
    """Build a conventional commit message."""
    return f"{change_type}({scope}): {summary}"

def run_git_op(repo_dir: str, op: str = 'status', message: str = '', dry_run: bool = True) -> dict:
    """Execute or preview safe git operations."""
    if op not in ['status', 'diff', 'commit', 'branch']:
        return {"ok": False, "error": f"Unknown git operation: {op}"}

    if op == 'commit' and not message:
        return {"ok": False, "error": "Commit message is required for 'commit' operation"}

    cmd_map = {
        'status': ['git', 'status', '--porcelain'],
        'diff': ['git', 'diff'],
        'commit': ['git', 'commit', '-m', message],
        'branch': ['git', 'branch'],
    }

    cmd = cmd_map[op]
    try:
        if dry_run:
            return {"ok": True, "dry_run": True, "command": ' '.join(cmd)}
        output = _run_cmd(cmd, cwd=repo_dir)
        return {"ok": True, "output": output}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": str(e)}

def execute(action: str = "parse_git_status_porcelain", **kwargs) -> dict:
    """Execute the specified action."""
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}

    if action == "parse_git_status_porcelain":
        raw_status = kwargs.get("raw_status", "")
        return parse_git_status_porcelain(raw_status)

    if action == "build_commit_message":
        change_type = kwargs.get("change_type", "feat")
        scope = kwargs.get("scope", "app")
        summary = kwargs.get("summary", "update")
        return {"ok": True, "message": build_commit_message(change_type, scope, summary)}

    if action == "run_git_op":
        repo_dir = kwargs.get("repo_dir", "")
        op = kwargs.get("op", "status")
        message = kwargs.get("message", "")
        dry_run = kwargs.get("dry_run", True)
        return run_git_op(repo_dir, op, message, dry_run)

    return {"ok": False, "error": "Invalid action"}
