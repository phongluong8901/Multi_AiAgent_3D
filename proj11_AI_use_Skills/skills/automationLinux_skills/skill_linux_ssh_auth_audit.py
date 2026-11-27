import os
import re
import subprocess
from pathlib import Path
from typing import List, Tuple, Dict

TOOL_SCHEMA = {   'name': 'skill_linux_ssh_auth_audit',
    'description': 'Kiểm tra bảo mật SSH Linux, phân tích auth.log phát hiện IP dò mật khẩu brute '
                   'force, kiểm tra cấu hình sshd_config và authorized_keys. Check SSH security by '
                   'parsing auth.log for brute-force attempts, auditing sshd_config settings, and '
                   'listing authorized SSH keys.',
    'risk_level': 'safe',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'parse_auth_log_failures',
                                                                  'audit_sshd_config',
                                                                  'list_authorized_keys'],
                                                      'type': 'string'},
                                        'lines': {'type': 'array', 'items': {'type': 'string'}},
                                        'threshold': {'type': 'integer'},
                                        'dry_run': {'type': 'boolean'},
                                        'config_text': {'type': 'string'},
                                        'auth_keys_path': {'type': 'string'}},
                      'required': ['action']}}

def _run_cmd(cmd: List[str]) -> Tuple[int, str, str]:
    """Helper function to run shell commands."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def parse_auth_log_failures(lines: List[str], threshold: int = 5, dry_run: bool = True) -> Dict[str, List[str]]:
    """Parse SSH auth log lines to spot brute-force source IPs above a threshold."""
    ip_count = {}
    for line in lines:
        match = re.search(r'Failed password for (?:invalid user )?\S+ from (\d+\.\d+\.\d+\.\d+)', line)
        if match:
            ip = match.group(1)
            ip_count[ip] = ip_count.get(ip, 0) + 1

    brute_force_ips = [ip for ip, count in ip_count.items() if count >= threshold]
    if dry_run:
        return {"ok": True, "brute_force_ips": brute_force_ips}
    else:
        return {"ok": False, "error": "Dry run mode is enabled."}

def audit_sshd_config(config_text: str, dry_run: bool = True) -> Dict[str, str]:
    """Audit SSHD config security settings."""
    settings = {
        "PermitRootLogin": "no",
        "PasswordAuthentication": "no"
    }
    config_lines = config_text.splitlines()
    issues = []

    for setting, expected_value in settings.items():
        for line in config_lines:
            if line.strip().startswith(setting):
                current_value = line.split()[1]
                if current_value != expected_value:
                    issues.append(f"{setting} should be {expected_value}, but found {current_value}")
                break
        else:
            issues.append(f"{setting} not found in config")

    if dry_run:
        return {"ok": True, "issues": issues}
    else:
        return {"ok": False, "error": "Dry run mode is enabled."}

def list_authorized_keys(auth_keys_path: str = '~/.ssh/authorized_keys', dry_run: bool = True) -> Dict[str, List[str]]:
    """List authorized SSH public keys."""
    path = Path(auth_keys_path).expanduser()
    try:
        with path.open('r', encoding='utf-8', errors='replace') as f:
            keys = [line.strip() for line in f if line.strip()]
    except FileNotFoundError:
        return {"ok": False, "error": f"File not found: {path}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

    if dry_run:
        return {"ok": True, "authorized_keys": keys}
    else:
        return {"ok": False, "error": "Dry run mode is enabled."}

def execute(action: str = "parse_auth_log_failures", **kwargs) -> Dict[str, str]:
    """Execute the specified action with the provided arguments."""
    dry_run = kwargs.get('dry_run', True)
    if action == "parse_auth_log_failures":
        lines = kwargs.get('lines', [])
        threshold = kwargs.get('threshold', 5)
        return parse_auth_log_failures(lines, threshold, dry_run)
    elif action == "audit_sshd_config":
        config_text = kwargs.get('config_text', "")
        return audit_sshd_config(config_text, dry_run)
    elif action == "list_authorized_keys":
        auth_keys_path = kwargs.get('auth_keys_path', '~/.ssh/authorized_keys')
        return list_authorized_keys(auth_keys_path, dry_run)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
