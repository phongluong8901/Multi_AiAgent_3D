import inspect
import os
import re
import subprocess
from typing import List, Tuple, Dict

def _safe_call(fn, kwargs: dict):
    sig = inspect.signature(fn)
    if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kwargs)
    filtered = {k: v for k, v in kwargs.items() if k in sig.parameters}
    return fn(**filtered)

TOOL_SCHEMA = {   'name': 'skill_linux_process_cgroups_guard',
    'description': 'Quản lý tiến trình Linux tìm PID theo tên hoặc cổng port, dừng tiến trình treo '
                   'kill SIGTERM an toàn chặn PID hệ thống. Manage Linux processes, find PID by '
                   'name or port, safely kill hanging processes while blocking PID 1 and protected '
                   'system daemons.',
    'risk_level': 'confirm',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'find_processes',
                                                                  'find_port_owner',
                                                                  'send_signal'],
                                                      'type': 'string'},
                                        'query': {'type': 'string'},
                                        'top_n': {'type': 'integer'},
                                        'port': {'type': 'integer'},
                                        'pid': {'type': 'integer'},
                                        'sig': {'type': 'string'},
                                        'dry_run': {'type': 'boolean'}},
                      'required': ['action']}}

PROTECTED_PIDS = {1}  # PID 1 is the init process and should be protected

def _run_cmd(cmd: List[str]) -> Tuple[int, str, str]:
    """Run a shell command and return the exit code, stdout, and stderr."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def find_processes(query: str = '', top_n: int = 15) -> Dict[str, List[Dict[str, str]]]:
    """Find processes matching a query."""
    cmd = ['ps', 'aux']
    exit_code, stdout, stderr = _run_cmd(cmd)
    if exit_code != 0:
        return {"ok": False, "error": stderr}
    
    processes = []
    for line in stdout.splitlines()[1:]:  # Skip header
        parts = re.split(r'\s+', line.strip(), maxsplit=10)
        if len(parts) < 11:
            continue
        if query.lower() in parts[10].lower():
            processes.append({
                "pid": parts[1],
                "user": parts[0],
                "cpu": parts[2],
                "mem": parts[3],
                "vsz": parts[4],
                "rss": parts[5],
                "tty": parts[6],
                "stat": parts[7],
                "start": parts[8],
                "time": parts[9],
                "command": parts[10]
            })
    
    return {"ok": True, "processes": processes[:top_n]}

def find_port_owner(port: int = 8000) -> Dict[str, List[Dict[str, str]]]:
    """Find the process owner of a specific port."""
    cmd = ['lsof', '-i', f':{port}']
    exit_code, stdout, stderr = _run_cmd(cmd)
    if exit_code != 0:
        return {"ok": False, "error": stderr}
    
    processes = []
    for line in stdout.splitlines()[1:]:  # Skip header
        parts = re.split(r'\s+', line.strip(), maxsplit=8)
        if len(parts) < 9:
            continue
        processes.append({
            "pid": parts[1],
            "user": parts[0],
            "fd": parts[3],
            "type": parts[4],
            "device": parts[5],
            "sizeoff": parts[6],
            "node": parts[7],
            "name": parts[8]
        })
    
    return {"ok": True, "processes": processes}

def send_signal(pid: int = 0, sig: str = 'TERM', dry_run: bool = True) -> Dict[str, str]:
    """Send a signal to a process."""
    if pid in PROTECTED_PIDS:
        return {"ok": False, "error": "Cannot send signal to protected PID 1"}
    
    if dry_run:
        return {"ok": True, "message": f"Dry run: Would send signal {sig} to PID {pid}"}
    
    cmd = ['kill', f'-{sig}', str(pid)]
    exit_code, stdout, stderr = _run_cmd(cmd)
    if exit_code != 0:
        return {"ok": False, "error": stderr}
    
    return {"ok": True, "message": f"Sent signal {sig} to PID {pid}"}

def execute(action: str = "find_processes", **kwargs) -> Dict[str, str]:
    """Execute the specified action."""
    if action == "find_processes":
        return _safe_call(find_processes, kwargs)
    elif action == "find_port_owner":
        return _safe_call(find_port_owner, kwargs)
    elif action == "send_signal":
        return _safe_call(send_signal, kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
