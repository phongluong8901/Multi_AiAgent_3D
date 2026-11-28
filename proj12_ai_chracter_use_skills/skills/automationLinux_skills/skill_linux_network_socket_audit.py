import subprocess
import re
import socket
import time
from typing import List, Dict, Tuple

TOOL_SCHEMA = {   'name': 'skill_linux_network_socket_audit',
    'description': 'Kiểm tra mạng Linux cổng đang mở ss netstat listening ports, kiểm tra kết nối '
                   'TCP tới host port. Check Linux network open ports using ss netstat listening '
                   'ports, test TCP connection to host port.',
    'risk_level': 'safe',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'parse_ss_listening',
                                                                  'list_listening_ports',
                                                                  'check_tcp_endpoint'],
                                                      'type': 'string'},
                                        'raw_ss': {'type': 'string'},
                                        'host': {'type': 'string'},
                                        'port': {'type': 'integer'},
                                        'timeout': {'type': 'number'}},
                      'required': ['action']}}

def _run_cmd(cmd: List[str]) -> Tuple[int, str, str]:
    """Run a shell command and return the exit code, stdout, and stderr."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def parse_ss_listening(raw_ss: str) -> List[Dict[str, str]]:
    """Parse the output of `ss -tulnp` into structured socket records."""
    pattern = re.compile(r'^tcp\s+\d+\s+\d+\s+([\d.]+):(\d+)\s+.*\s+users:\(\(.*\)\)$')
    records = []
    for line in raw_ss.strip().split('\n'):
        match = pattern.match(line)
        if match:
            records.append({"ip": match.group(1), "port": match.group(2)})
    return records

def list_listening_ports() -> List[Dict[str, str]]:
    """List active listening ports via _run_cmd."""
    _, output, _ = _run_cmd(["ss", "-tulnp"])
    return parse_ss_listening(output)

def _tcp_connect(host: str, port: int, timeout: float) -> bool:
    """Helper to check TCP endpoint reachability."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except socket.error:
        return False

def check_tcp_endpoint(host: str, port: int = 22, timeout: float = 3.0) -> bool:
    """Test TCP endpoint reachability."""
    return _tcp_connect(host, port, timeout)

def execute(action: str = "list_listening_ports", **kwargs) -> Dict[str, any]:
    """Execute the specified action."""
    if action == "parse_ss_listening":
        raw_ss = kwargs.get("raw_ss", "")
        if not raw_ss:
            return {"ok": False, "error": "raw_ss parameter is required"}
        return {"ok": True, "data": parse_ss_listening(raw_ss)}
    elif action == "list_listening_ports":
        return {"ok": True, "data": list_listening_ports()}
    elif action == "check_tcp_endpoint":
        host = kwargs.get("host", "")
        port = kwargs.get("port", 22)
        timeout = kwargs.get("timeout", 3.0)
        if not host:
            return {"ok": False, "error": "host parameter is required"}
        return {"ok": True, "data": check_tcp_endpoint(host, port, timeout)}
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
