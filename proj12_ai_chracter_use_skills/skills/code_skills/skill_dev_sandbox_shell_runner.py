import os
import re
import json
import subprocess
import time
from pathlib import Path

TOOL_SCHEMA = {
    "name": "skill_dev_sandbox_shell_runner",
    "description": "Safe coding-agent command and background dev-server runner: check commands against a destructive blocklist (`rm -rf /`, `mkfs`, `shutdown`, `reboot`, `dd if=`, `:(){`), run commands via mockable `_run_cmd` (dry_run=True default), and manage background process records in a JSON state file via mockable `_spawn_bg`, `_is_pid_alive`, and `_terminate_pid`.",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["validate_command_safety", "run_workspace_cmd", "manage_bg_process"]},
        },
        "required": ["action"],
    },
}

DESTRUCTIVE_COMMANDS = [
    r"rm\s+-rf\s+/",
    r"mkfs",
    r"shutdown",
    r"reboot",
    r"dd\s+if=",
    r":\(\)\s*\{",
]

def _run_cmd(cmd: list[str], cwd: str = None, timeout_sec: int = 30) -> subprocess.CompletedProcess:
    if cwd is None:
        cwd = os.getcwd()
    return subprocess.run(cmd, cwd=cwd, timeout=timeout_sec, capture_output=True, text=True)

def _spawn_bg(cmd: list[str], cwd: str, log_path: str) -> int:
    with open(log_path, 'a') as log_file:
        process = subprocess.Popen(cmd, cwd=cwd, stdout=log_file, stderr=log_file)
    return process.pid

def _is_pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    return True

def _terminate_pid(pid: int) -> bool:
    try:
        os.kill(pid, 9)
        return True
    except ProcessLookupError:
        return False

def validate_command_safety(command: str) -> dict:
    for pattern in DESTRUCTIVE_COMMANDS:
        if re.search(pattern, command):
            return {'ok': True, 'safe': False, 'reason': f"Command matches destructive pattern: {pattern}"}
    return {'ok': True, 'safe': True, 'reason': "Command is safe"}

def run_workspace_cmd(command: str, cwd: str = '.', timeout_sec: int = 30, dry_run: bool = True) -> dict:
    if dry_run:
        return {'ok': True, 'dry_run': True, 'command': command}
    
    cmd_list = command.split()
    try:
        result = _run_cmd(cmd_list, cwd, timeout_sec)
        return {'ok': True, 'returncode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}
    except subprocess.TimeoutExpired:
        return {'ok': False, 'error': "Command timed out"}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

def manage_bg_process(op: str = 'status', name: str = 'dev_server', command: str = '', cwd: str = '.', state_path: str = 'bg_procs.json', dry_run: bool = True) -> dict:
    state_file = Path(state_path)
    if not state_file.exists():
        state_file.write_text(json.dumps({}))

    state = json.loads(state_file.read_text())
    
    if op == 'start':
        if name in state and _is_pid_alive(state[name]['pid']):
            return {'ok': False, 'error': f"Process {name} is already running"}
        
        if dry_run:
            return {'ok': True, 'dry_run': True, 'action': 'start', 'name': name, 'command': command}
        
        log_path = f"{name}.log"
        pid = _spawn_bg(command.split(), cwd, log_path)
        state[name] = {'pid': pid, 'log_path': log_path}
        state_file.write_text(json.dumps(state))
        return {'ok': True, 'pid': pid, 'log_path': log_path}
    
    elif op == 'status':
        if name in state:
            pid = state[name]['pid']
            is_alive = _is_pid_alive(pid)
            return {'ok': True, 'name': name, 'pid': pid, 'is_alive': is_alive}
        return {'ok': False, 'error': f"Process {name} not found"}
    
    elif op == 'stop':
        if name in state:
            pid = state[name]['pid']
            if _terminate_pid(pid):
                del state[name]
                state_file.write_text(json.dumps(state))
                return {'ok': True, 'pid': pid, 'terminated': True}
            return {'ok': False, 'error': f"Failed to terminate process {name}"}
        return {'ok': False, 'error': f"Process {name} not found"}
    
    return {'ok': False, 'error': f"Unknown operation: {op}"}

def execute(action: str = "validate_command_safety", **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    if action == "validate_command_safety":
        return validate_command_safety(**kwargs)
    elif action == "run_workspace_cmd":
        return run_workspace_cmd(**kwargs)
    elif action == "manage_bg_process":
        return manage_bg_process(**kwargs)
