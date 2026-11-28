import json
import subprocess
import re

TOOL_SCHEMA = {   'name': 'skill_linux_vpn_tunnel_monitor',
    'description': 'Giám sát mạng riêng ảo VPN tunnel Linux Tailscale WireGuard, kiểm tra peer '
                   'đang kết nối và trạng thái dịch vụ tunnel. Monitor VPN peers/online state and '
                   'inspect or plan restart of tunnel services.',
    'risk_level': 'safe',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'parse_tailscale_status',
                                                                  'parse_wireguard_show',
                                                                  'check_tunnel_service'],
                                                      'type': 'string'},
                                        'raw_json': {'type': 'string'},
                                        'raw_wg': {'type': 'string'},
                                        'service_name': {'type': 'string'},
                                        'dry_run': {'type': 'boolean'}},
                      'required': ['action']}}

def _run_cmd(cmd: list[str]) -> tuple[int, str, str]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def parse_tailscale_status(raw_json: str) -> dict:
    try:
        data = json.loads(raw_json)
        peers = data.get("Peer", [])
        peers_iter = peers.values() if isinstance(peers, dict) else peers
        summary = {
            "peers": [
                {
                    "name": peer.get("HostName"),
                    "status": peer.get("Online"),
                    "last_seen": peer.get("LastSeen")
                }
                for peer in peers_iter
                if isinstance(peer, dict)
            ]
        }
        return {"ok": True, "summary": summary}
    except json.JSONDecodeError as e:
        return {"ok": False, "error": f"Invalid JSON: {str(e)}"}

def parse_wireguard_show(raw_wg: str) -> dict:
    try:
        peers = []
        for line in raw_wg.strip().split('\n'):
            if line.startswith('peer:'):
                peer = re.search(r'peer: (\S+)', line)
                if peer:
                    peers.append({"public_key": peer.group(1)})
        summary = {"peers": peers}
        return {"ok": True, "summary": summary}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def check_tunnel_service(service_name: str = 'tailscaled', dry_run: bool = True) -> dict:
    try:
        code, stdout, stderr = _run_cmd(['systemctl', 'is-active', service_name])
        if code != 0:
            return {"ok": False, "error": f"Service {service_name} is not active: {stderr}"}
        
        if dry_run:
            return {"ok": True, "message": f"Service {service_name} is active. Restart planned (dry run)."}
        
        code, stdout, stderr = _run_cmd(['systemctl', 'restart', service_name])
        if code != 0:
            return {"ok": False, "error": f"Failed to restart service {service_name}: {stderr}"}
        
        return {"ok": True, "message": f"Service {service_name} restarted successfully."}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def execute(action: str = "parse_tailscale_status", **kwargs) -> dict:
    if action == "parse_tailscale_status":
        raw_json = kwargs.get("raw_json", "")
        return parse_tailscale_status(raw_json)
    elif action == "parse_wireguard_show":
        raw_wg = kwargs.get("raw_wg", "")
        return parse_wireguard_show(raw_wg)
    elif action == "check_tunnel_service":
        service_name = kwargs.get("service_name", "tailscaled")
        dry_run = kwargs.get("dry_run", True)
        return check_tunnel_service(service_name, dry_run)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
