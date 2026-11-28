import re
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional

TOOL_SCHEMA = {   'name': 'skill_linux_firewall_ufw_guard',
    'description': 'Quản lý tường lửa Linux UFW firewall, rà soát cổng mở nguy hiểm, tạo luật '
                   'allow deny bảo vệ không tự khóa SSH cổng 22. Manage Linux UFW firewall, audit '
                   'exposed ports, and build safe UFW rules without blocking SSH port 22.',
    'risk_level': 'confirm',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'parse_ufw_status',
                                                                  'audit_exposed_ports',
                                                                  'build_ufw_rule'],
                                                      'type': 'string'},
                                        'raw_ufw': {'type': 'string'},
                                        'rules': {'type': 'array', 'items': {'type': 'object'}},
                                        'allowlist_ports': {   'type': 'array',
                                                               'items': {'type': 'integer'}},
                                        'port': {'type': 'integer'},
                                        'proto': {'type': 'string'},
                                        'rule_op': {'type': 'string'},
                                        'from_ip': {'type': 'string'},
                                        'dry_run': {'type': 'boolean'}},
                      'required': ['action']}}

def _run_cmd(cmd: List[str]) -> tuple[int, str, str]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=True)
        return result.returncode, result.stdout, result.stderr
    except subprocess.CalledProcessError as e:
        return e.returncode, e.stdout or "", e.stderr or ""
    except Exception as e:
        return 1, "", str(e)

def parse_ufw_status(raw_ufw: str) -> List[Dict[str, Any]]:
    rules = []
    for line in raw_ufw.splitlines():
        match = re.match(r'(\d+)/(\w+)\s+(ALLOW|DENY)\s+(.*)', line)
        if match:
            port, proto, action, from_ip = match.groups()
            rules.append({
                "port": int(port),
                "proto": proto,
                "action": action.lower(),
                "from_ip": from_ip.strip()
            })
    return rules

def audit_exposed_ports(rules: List[Dict[str, Any]], allowlist_ports: Optional[List[int]] = None) -> List[Dict[str, Any]]:
    allowlist_ports = allowlist_ports or []
    exposed_ports = []
    for rule in rules:
        if rule['action'] == 'allow' and rule['port'] not in allowlist_ports:
            exposed_ports.append(rule)
    return exposed_ports

def build_ufw_rule(port: int, proto: str = 'tcp', rule_op: str = 'allow', from_ip: str = 'any', dry_run: bool = True) -> Dict[str, Any]:
    if port == 22 and rule_op.lower() == 'deny':
        return {"ok": False, "error": "Cannot deny SSH port 22"}
    cmd = ['ufw', rule_op, f'{port}/{proto}', 'from', from_ip]
    if dry_run:
        return {"ok": True, "command": ' '.join(cmd)}
    else:
        return_code, stdout, stderr = _run_cmd(cmd)
        if return_code == 0:
            return {"ok": True, "message": stdout.strip()}
        else:
            return {"ok": False, "error": stderr.strip()}

def execute(action: str = "parse_ufw_status", **kwargs) -> Dict[str, Any]:
    if action == "parse_ufw_status":
        raw_ufw = kwargs.get("raw_ufw", "")
        return {"ok": True, "rules": parse_ufw_status(raw_ufw)}
    elif action == "audit_exposed_ports":
        rules = kwargs.get("rules", [])
        allowlist_ports = kwargs.get("allowlist_ports", [])
        return {"ok": True, "exposed_ports": audit_exposed_ports(rules, allowlist_ports)}
    elif action == "build_ufw_rule":
        port = kwargs.get("port", 0)
        proto = kwargs.get("proto", "tcp")
        rule_op = kwargs.get("rule_op", "allow")
        from_ip = kwargs.get("from_ip", "any")
        dry_run = kwargs.get("dry_run", True)
        return build_ufw_rule(port, proto, rule_op, from_ip, dry_run)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
