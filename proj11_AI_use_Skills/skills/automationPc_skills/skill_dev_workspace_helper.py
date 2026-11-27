import os
import json
import subprocess
import sys

TOOL_SCHEMA = {
    "name": "skill_dev_workspace_helper",
    "risk_level": "safe",
    "description": "Inspect Git status/branches/recent commits, parse git porcelain output, check Python/Node versions, and open folders in VS Code. Kiểm tra trạng thái Git status diff branch, mở dự án trong VS Code, xem phiên bản Python Node",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["git_status", "git_recent_log", "open_in_vscode", "parse_git_status_porcelain"]
            },
            "repo_path": {
                "type": "string",
                "default": "."
            },
            "limit": {
                "type": "integer",
                "default": 10
            },
            "path": {
                "type": "string",
                "default": "."
            },
            "output": {
                "type": "string",
                "default": ""
            },
            "dry_run": {
                "type": "boolean",
                "default": False
            }
        },
        "required": ["action"]
    }
}

def execute(action: str = "git_status", **kwargs) -> dict:
    if action == "git_status":
        return _safe_call(git_status, kwargs)
    elif action == "git_recent_log":
        return _safe_call(git_recent_log, kwargs)
    elif action == "open_in_vscode":
        return _safe_call(open_in_vscode, kwargs)
    elif action == "parse_git_status_porcelain":
        return _safe_call(parse_git_status_porcelain, kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def git_status(repo_path: str = ".", dry_run: bool = False) -> dict:
    try:
        import subprocess
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    
    if dry_run:
        return {"ok": True, "preview": f"Would run git status in {repo_path}"}
    
    try:
        result = subprocess.run(["git", "-C", repo_path, "status", "--porcelain"], capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
        return {"ok": True, "output": result.stdout}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": str(e)}

def git_recent_log(repo_path: str = ".", limit: int = 10, dry_run: bool = False) -> dict:
    try:
        import subprocess
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    
    if dry_run:
        return {"ok": True, "preview": f"Would run git log in {repo_path} with limit {limit}"}
    
    try:
        result = subprocess.run(["git", "-C", repo_path, "log", "--oneline", f"-{limit}"], capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
        return {"ok": True, "output": result.stdout}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": str(e)}

def open_in_vscode(path: str = ".", dry_run: bool = False) -> dict:
    try:
        import subprocess
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    
    if dry_run:
        return {"ok": True, "preview": f"Would open {path} in VS Code"}
    
    try:
        subprocess.run(["code", path], check=True)
        return {"ok": True, "message": f"Opened {path} in VS Code"}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": str(e)}

def parse_git_status_porcelain(output: str = "", dry_run: bool = False) -> dict:
    if dry_run:
        return {"ok": True, "preview": f"Would parse git status porcelain output: {output}"}
    
    lines = output.splitlines()
    changes = []
    for line in lines:
        if line:
            changes.append({"status": line[:2], "file": line[3:]})
    return {"ok": True, "changes": changes}

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
