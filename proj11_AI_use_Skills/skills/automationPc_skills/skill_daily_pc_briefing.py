import os
import time
from datetime import datetime, timedelta

TOOL_SCHEMA = {
    "name": "skill_daily_pc_briefing",
    "description": "Compile a concise daily PC health briefing combining disk/OS basics, recent files in Downloads, and optional custom checklist items.",
    "risk_level": "safe",
    "parameters": {
        "downloads_dir": "str",
        "recent_hours": "int",
        "root": "str",
        "dry_run": "bool",
        "limit": "int"
    }
}

def _get_disk_usage():
    try:
        import shutil
        total, used, free = shutil.disk_usage("/")
        return {"total": total, "used": used, "free": free}
    except ImportError:
        return {"ok": False, "error": "Missing package shutil"}

def _list_recent_files(folder, hours, limit):
    try:
        recent_files = []
        cutoff_time = time.time() - (hours * 3600)
        for root, dirnames, files in os.walk(folder):
            dirnames[:] = [d for d in dirnames if d.lower() not in {'.git', 'node_modules', '__pycache__', '.venv', 'venv', 'appdata', 'windows', '$recycle.bin', 'programdata'}]
            for file in files:
                file_path = os.path.join(root, file)
                file_stat = os.stat(file_path)
                if file_stat.st_mtime >= cutoff_time:
                    recent_files.append((file_path, file_stat.st_mtime))
        recent_files.sort(key=lambda x: x[1], reverse=True)
        return [file_path for file_path, _ in recent_files[:limit]]
    except Exception as e:
        return {"ok": False, "error": str(e)}

def generate_briefing(downloads_dir="", recent_hours=24):
    disk_usage = _get_disk_usage()
    if not disk_usage.get("ok", True):
        return disk_usage

    recent_files = _list_recent_files(downloads_dir, recent_hours, 15)
    if isinstance(recent_files, dict) and not recent_files.get("ok", True):
        return recent_files

    return {
        "ok": True,
        "disk_usage": disk_usage,
        "recent_files": recent_files
    }

def execute(action: str = "generate_briefing", **kwargs) -> dict:
    root = kwargs.get("root", ".")
    dry_run = kwargs.get("dry_run", True)
    limit = kwargs.get("limit", 10)

    if action == "generate_briefing":
        downloads_dir = kwargs.get("downloads_dir", os.path.join(root, "Downloads"))
        recent_hours = kwargs.get("recent_hours", 24)
        return generate_briefing(downloads_dir, recent_hours)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
