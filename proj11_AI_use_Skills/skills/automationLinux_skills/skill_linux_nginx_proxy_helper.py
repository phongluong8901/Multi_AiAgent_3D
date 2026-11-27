import os
import re
import socket
import subprocess
import urllib.request
import ssl
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, List, Tuple, Dict

TOOL_SCHEMA = {   'name': 'skill_linux_nginx_proxy_helper',
    'description': 'Quản lý cấu hình Nginx Reverse Proxy trên Linux, tạo file cấu hình hỗ trợ '
                   'WebSocket, kiểm tra ngày hết hạn chứng chỉ SSL TLS',
    'risk_level': 'safe',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'parse_nginx_server_blocks',
                                                                  'generate_reverse_proxy_conf',
                                                                  'check_tls_expiry'],
                                                      'type': 'string'},
                                        'config_text': {'type': 'string'},
                                        'domain': {'type': 'string'},
                                        'upstream': {'type': 'string'},
                                        'enable_ws': {'type': 'boolean'},
                                        'dry_run': {'type': 'boolean'},
                                        'host': {'type': 'string'},
                                        'port': {'type': 'integer'},
                                        'timeout': {'type': 'number'}},
                      'required': ['action']}}

def _run_cmd(cmd: List[str]) -> Tuple[int, str, str]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def _http_get(url: str, timeout: float = 5.0) -> Tuple[int, bytes]:
    try:
        context = ssl.create_default_context()
        with urllib.request.urlopen(url, timeout=timeout, context=context) as response:
            return response.status, response.read()
    except Exception as e:
        return 1, str(e).encode()

def parse_nginx_server_blocks(config_text: str) -> List[Dict[str, str]]:
    server_blocks = []
    server_block_pattern = re.compile(r'server\s*\{([^}]*?)\}', re.DOTALL)
    server_blocks_text = server_block_pattern.findall(config_text)
    
    for block in server_blocks_text:
        server_name = re.search(r'server_name\s+([\w.]+);', block)
        listen = re.search(r'listen\s+(\d+);', block)
        proxy_pass = re.search(r'proxy_pass\s+([\w:/.]+);', block)
        
        if server_name and listen and proxy_pass:
            server_blocks.append({
                'server_name': server_name.group(1),
                'listen': listen.group(1),
                'proxy_pass': proxy_pass.group(1)
            })
    
    return server_blocks

def generate_reverse_proxy_conf(domain: str, upstream: str = 'http://127.0.0.1:8000', enable_ws: bool = True, dry_run: bool = True, output_dir: str = '') -> Dict[str, Any]:
    config = f"server {{\n    listen 80;\n    server_name {domain};\n\n    location / {{\n        proxy_pass {upstream};\n"
    
    if enable_ws:
        config += "        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection 'upgrade';\n        proxy_set_header Host $host;\n"
    
    config += "    }\n}\n"
    saved_path = ""
    if not dry_run:
        safe_name = re.sub(r'[^a-zA-Z0-9._-]', '_', domain or 'default')
        if output_dir:
            base_dir = Path(output_dir)
        elif os.name != "nt" and Path("/etc/nginx/sites-available").exists() and os.access("/etc/nginx/sites-available", os.W_OK):
            base_dir = Path("/etc/nginx/sites-available")
        else:
            base_dir = Path("outputs") / "nginx" / "sites-available"
        base_dir.mkdir(parents=True, exist_ok=True)
        config_path = base_dir / safe_name
        with open(config_path, "w", encoding="utf-8") as f:
            f.write(config)
        saved_path = str(config_path)
    
    res: Dict[str, Any] = {"ok": True, "config": config}
    if saved_path:
        res["path"] = saved_path
    return res

def check_tls_expiry(host: str, port: int = 443, timeout: float = 5.0) -> Dict[str, Any]:
    try:
        context = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=timeout) as sock:
            with context.wrap_socket(sock, server_hostname=host) as ssock:
                cert = ssock.getpeercert()
                expiry_date = ssl.cert_time_to_seconds(cert['notAfter'])
                return {"ok": True, "expiry_date": datetime.fromtimestamp(expiry_date, tz=timezone.utc).isoformat()}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def execute(action: str = "parse_nginx_server_blocks", **kwargs) -> Dict[str, str]:
    dry_run = kwargs.get('dry_run', True)
    
    if action == "parse_nginx_server_blocks":
        config_text = kwargs.get('config_text', '')
        return {"ok": True, "server_blocks": parse_nginx_server_blocks(config_text)}
    
    elif action == "generate_reverse_proxy_conf":
        domain = kwargs.get('domain', '')
        upstream = kwargs.get('upstream', 'http://127.0.0.1:8000')
        enable_ws = kwargs.get('enable_ws', True)
        return generate_reverse_proxy_conf(domain, upstream, enable_ws, dry_run)
    
    elif action == "check_tls_expiry":
        host = kwargs.get('host', '')
        port = kwargs.get('port', 443)
        timeout = kwargs.get('timeout', 5.0)
        return check_tls_expiry(host, port, timeout)
    
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
