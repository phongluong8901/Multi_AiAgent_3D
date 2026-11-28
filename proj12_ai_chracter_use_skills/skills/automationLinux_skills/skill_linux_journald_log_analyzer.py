import subprocess
import re
from typing import List, Dict, Tuple

TOOL_SCHEMA = {   'name': 'skill_linux_journald_log_analyzer',
    'description': 'đọc phân tích log hệ thống Linux journalctl systemd, lọc lỗi error warning '
                   'theo service, phát hiện OOM Killer crash loop\n'
                   'Read and analyze Linux system logs using journalctl systemd, filter errors and '
                   'warnings by service, detect OOM Killer crash loop',
    'risk_level': 'safe',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'query_journal_logs',
                                                                  'analyze_log_lines',
                                                                  'detect_oom_events'],
                                                      'type': 'string'},
                                        'unit': {'type': 'string'},
                                        'priority': {'type': 'string'},
                                        'lines': {'type': 'integer'},
                                        'log_lines': {'type': 'array', 'items': {'type': 'string'}},
                                        'dry_run': {'type': 'boolean'}},
                      'required': ['action']}}

def _run_cmd(cmd: List[str]) -> Tuple[int, str, str]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def query_journal_logs(unit: str = '', priority: str = 'err', lines: int = 50, dry_run: bool = True) -> Dict[str, any]:
    if dry_run:
        return {"ok": True, "dry_run": True, "command": f"journalctl -u {unit} -p {priority} -n {lines}"}
    
    cmd = ["journalctl", "-u", unit, "-p", priority, "-n", str(lines)]
    return_code, stdout, stderr = _run_cmd(cmd)
    
    if return_code != 0:
        return {"ok": False, "error": stderr}
    
    return {"ok": True, "logs": stdout.splitlines()}

def analyze_log_lines(lines: List[str]) -> Dict[str, int]:
    severity_counts = {"error": 0, "warning": 0}
    for line in lines:
        if re.search(r'\bERROR\b', line, re.IGNORECASE):
            severity_counts["error"] += 1
        elif re.search(r'\bWARNING\b', line, re.IGNORECASE):
            severity_counts["warning"] += 1
    return severity_counts

def detect_oom_events(lines: List[str]) -> List[str]:
    oom_events = []
    oom_pattern = re.compile(r'Out of memory: Kill process \d+ \((\w+)\)')
    for line in lines:
        match = oom_pattern.search(line)
        if match:
            oom_events.append(match.group(1))
    return oom_events

def execute(action: str = "query_journal_logs", **kwargs) -> Dict[str, any]:
    dry_run = kwargs.get("dry_run", True)
    if action == "query_journal_logs":
        unit = kwargs.get("unit", "")
        priority = kwargs.get("priority", "err")
        lines = kwargs.get("lines", 50)
        return query_journal_logs(unit, priority, lines, dry_run)
    elif action == "analyze_log_lines":
        raw = kwargs.get("log_lines") if "log_lines" in kwargs else kwargs.get("lines", [])
        lines = raw if isinstance(raw, list) else []
        return {"ok": True, "severity_counts": analyze_log_lines(lines)}
    elif action == "detect_oom_events":
        raw = kwargs.get("log_lines") if "log_lines" in kwargs else kwargs.get("lines", [])
        lines = raw if isinstance(raw, list) else []
        return {"ok": True, "oom_events": detect_oom_events(lines)}
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
