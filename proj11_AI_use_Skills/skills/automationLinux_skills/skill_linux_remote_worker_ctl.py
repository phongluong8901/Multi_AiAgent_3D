import inspect
import os
import json
import socket
import subprocess
from pathlib import Path
from typing import List, Dict, Tuple, Union

def _safe_call(fn, kwargs: dict):
    sig = inspect.signature(fn)
    if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kwargs)
    filtered = {k: v for k, v in kwargs.items() if k in sig.parameters}
    return fn(**filtered)

TOOL_SCHEMA = {   'name': 'skill_linux_remote_worker_ctl',
    'description': 'Quản lý nhiều máy Linux từ xa inventory nodes JSON, kiểm tra sức khỏe đồng '
                   'loạt các worker node, tạo lệnh SSH thực thi từ xa an toàn. Manage a JSON '
                   'inventory of Linux worker nodes (add/list/remove), check TCP/SSH reachability '
                   'across nodes via a mockable helper, and safely construct remote SSH execution '
                   'commands.',
    'risk_level': 'confirm',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'manage_inventory',
                                                                  'check_nodes_health',
                                                                  'build_ssh_exec_cmd'],
                                                      'type': 'string'},
                                        'inventory_path': {'type': 'string'},
                                        'mode': {'type': 'string'},
                                        'node': {'type': 'object'},
                                        'dry_run': {'type': 'boolean'},
                                        'nodes': {'type': 'array', 'items': {'type': 'object'}},
                                        'timeout': {'type': 'number'},
                                        'host': {'type': 'string'},
                                        'command': {'type': 'string'},
                                        'user': {'type': 'string'},
                                        'port': {'type': 'integer'}},
                      'required': ['action']}}

def _run_cmd(cmd: List[str]) -> Tuple[int, str, str]:
    """Helper function to run shell commands."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def _check_tcp_port(host: str, port: int, timeout: float = 2.0) -> bool:
    """Helper function to check TCP port reachability."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(timeout)
        return s.connect_ex((host, port)) == 0

def manage_inventory(inventory_path: str = 'nodes.json', mode: str = 'list', node: Dict = None, dry_run: bool = True) -> Dict:
    """Manage the inventory of Linux worker nodes."""
    inventory_path = Path(inventory_path)
    if mode == 'list':
        if not inventory_path.exists():
            return {"ok": False, "error": f"Inventory file {inventory_path} does not exist."}
        with open(inventory_path, 'r', encoding='utf-8') as f:
            nodes = json.load(f)
        return {"ok": True, "nodes": nodes}
    elif mode == 'add':
        if node is None:
            return {"ok": False, "error": "Node information is required for adding."}
        if not inventory_path.exists():
            nodes = []
        else:
            with open(inventory_path, 'r', encoding='utf-8') as f:
                nodes = json.load(f)
        nodes.append(node)
        if not dry_run:
            inventory_path.parent.mkdir(parents=True, exist_ok=True)
            with open(inventory_path, 'w', encoding='utf-8') as f:
                json.dump(nodes, f, indent=4)
        return {"ok": True, "message": "Node added successfully."}
    elif mode == 'remove':
        if node is None:
            return {"ok": False, "error": "Node information is required for removal."}
        if not inventory_path.exists():
            return {"ok": False, "error": f"Inventory file {inventory_path} does not exist."}
        with open(inventory_path, 'r', encoding='utf-8') as f:
            nodes = json.load(f)
        nodes = [n for n in nodes if n != node]
        if not dry_run:
            inventory_path.parent.mkdir(parents=True, exist_ok=True)
            with open(inventory_path, 'w', encoding='utf-8') as f:
                json.dump(nodes, f, indent=4)
        return {"ok": True, "message": "Node removed successfully."}
    else:
        return {"ok": False, "error": f"Unknown mode {mode}."}

def check_nodes_health(nodes: List[Dict] = None, timeout: float = 2.0) -> Dict:
    """Check the health of the nodes by verifying SSH reachability."""
    results = []
    for node in (nodes or []):
        host = node.get('host')
        port = node.get('port', 22)
        reachable = _check_tcp_port(host, port, timeout)
        results.append({"host": host, "port": port, "reachable": reachable})
    return {"ok": True, "results": results}

def build_ssh_exec_cmd(host: str = '', command: str = '', user: str = 'root', port: int = 22) -> Dict:
    """Build a safe SSH execution command."""
    cmd = ['ssh', f"{user}@{host}", '-p', str(port), command]
    return {"ok": True, "command": cmd}

def execute(action: str = "manage_inventory", **kwargs) -> Dict:
    """Execute the specified action."""
    if action == "manage_inventory":
        return _safe_call(manage_inventory, kwargs)
    elif action == "check_nodes_health":
        return _safe_call(check_nodes_health, kwargs)
    elif action == "build_ssh_exec_cmd":
        return _safe_call(build_ssh_exec_cmd, kwargs)
    else:
        return {"ok": False, "error": f"Unknown action {action}."}
