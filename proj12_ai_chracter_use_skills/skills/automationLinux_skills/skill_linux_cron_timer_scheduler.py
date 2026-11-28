import os
from pathlib import Path
import re
import subprocess
from typing import List, Dict, Tuple

TOOL_SCHEMA = {   'name': 'skill_linux_cron_timer_scheduler',
    'description': 'Lập lịch chạy tự động Linux crontab cronjob systemd timer, kiểm tra cú pháp '
                   'biểu thức cron, đọc và tạo dòng cron mới',
    'risk_level': 'confirm',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'validate_cron_expr',
                                                                  'parse_crontab',
                                                                  'build_cron_entry',
                                                                  'list_systemd_timers'],
                                                      'type': 'string'},
                                        'expr': {'type': 'string'},
                                        'raw_crontab': {'type': 'string'},
                                        'command': {'type': 'string'},
                                        'comment': {'type': 'string'},
                                        'dry_run': {'type': 'boolean'}},
                      'required': ['action']}}

def _run_cmd(cmd: List[str]) -> Tuple[int, str, str]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def validate_cron_expr(expr: str) -> bool:
    cron_regex = re.compile(r'^(?:\*|[0-9\-\/,]+)\s+(?:\*|[0-9\-\/,]+)\s+(?:\*|[0-9\-\/,]+)\s+(?:\*|[0-9\-\/,]+)\s+(?:\*|[0-9\-\/,]+)$')
    return bool(cron_regex.match(expr))

def parse_crontab(raw_crontab: str) -> List[Dict[str, str]]:
    entries = []
    for line in raw_crontab.splitlines():
        line = line.strip()
        if line and not line.startswith('#'):
            parts = line.split(maxsplit=5)
            if len(parts) >= 5:
                expr = ' '.join(parts[:5])
                command = ' '.join(parts[5:])
                entries.append({"expression": expr, "command": command})
    return entries

def build_cron_entry(expr: str, command: str, comment: str = '', dry_run: bool = True) -> Dict[str, str]:
    if not validate_cron_expr(expr):
        return {"ok": False, "error": "Invalid cron expression"}
    cron_line = f"{expr} {command}"
    if comment:
        cron_line = f"# {comment}\n{cron_line}"
    if not dry_run:
        try:
            with open("/etc/crontab", "a") as crontab_file:
                crontab_file.write(cron_line + "\n")
        except OSError:
            fallback = Path("outputs") / "cron" / "crontab"
            fallback.parent.mkdir(parents=True, exist_ok=True)
            with open(fallback, "a", encoding="utf-8") as crontab_file:
                crontab_file.write(cron_line + "\n")
    return {"ok": True, "cron_line": cron_line}

def list_systemd_timers() -> List[str]:
    returncode, stdout, stderr = _run_cmd(["systemctl", "list-timers", "--all", "--no-pager"])
    if returncode != 0:
        return {"ok": False, "error": stderr}
    return stdout.splitlines()

def execute(action: str = "", **kwargs) -> Dict[str, str]:
    dry_run = kwargs.get("dry_run", True)
    if action == "validate_cron_expr":
        expr = kwargs.get("expr", "")
        return {"ok": validate_cron_expr(expr)}
    elif action == "parse_crontab":
        raw_crontab = kwargs.get("raw_crontab", "")
        return {"ok": True, "entries": parse_crontab(raw_crontab)}
    elif action == "build_cron_entry":
        expr = kwargs.get("expr", "")
        command = kwargs.get("command", "")
        comment = kwargs.get("comment", "")
        return build_cron_entry(expr, command, comment, dry_run)
    elif action == "list_systemd_timers":
        return {"ok": True, "timers": list_systemd_timers()}
    else:
        return {"ok": False, "error": "Unknown action"}
