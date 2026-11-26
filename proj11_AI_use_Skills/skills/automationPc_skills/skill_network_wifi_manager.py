import json
import subprocess
import sys
import types
from typing import Dict, Any

TOOL_SCHEMA = {
    "name": "skill_network_wifi_manager",
    "risk_level": "safe",
    "description": "Inspect local IP/Wi-Fi SSID via netsh/PowerShell, run ping & TCP reachability tests, parse Wi-Fi profiles, and check proxy settings. "
                   "xem mạng Wi-Fi đang kết nối, địa chỉ IP nội bộ, kiểm tra ping độ trễ, tra cứu DNS, xóa cache DNS, trạng thái proxy",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["get_network_info", "list_wifi_networks", "ping_host", "check_proxy"]
            },
            "host": {
                "type": "string",
                "default": "8.8.8.8"
            },
            "count": {
                "type": "integer",
                "default": 3
            }
        },
        "required": ["action"]
    }
}

def _run_cmd(command: str) -> str:
    try:
        result = subprocess.run(command, shell=True, check=True, text=True, capture_output=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        return e.stderr

def get_network_info() -> Dict[str, Any]:
    try:
        import ipaddress
    except ImportError:
        return {"ok": False, "error": "Missing package ipaddress"}
    
    try:
        ip_info = _run_cmd("ipconfig")
        ssid_info = _run_cmd("netsh wlan show interfaces")
        
        ip_address = None
        ssid = None
        
        for line in ip_info.splitlines():
            if "IPv4 Address" in line:
                ip_address = line.split(":")[1].strip()
                break
        
        for line in ssid_info.splitlines():
            if "SSID" in line:
                ssid = line.split(":")[1].strip()
                break
        
        return {
            "ok": True,
            "ip_address": ip_address,
            "ssid": ssid
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}

def list_wifi_networks() -> Dict[str, Any]:
    try:
        wifi_info = _run_cmd("netsh wlan show networks")
        networks = []
        current_network = {}
        
        for line in wifi_info.splitlines():
            if "SSID" in line:
                if current_network:
                    networks.append(current_network)
                current_network = {"ssid": line.split(":")[1].strip()}
            elif "Authentication" in line:
                current_network["authentication"] = line.split(":")[1].strip()
            elif "Cipher" in line:
                current_network["cipher"] = line.split(":")[1].strip()
        
        if current_network:
            networks.append(current_network)
        
        return {
            "ok": True,
            "networks": networks
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}

def ping_host(host: str = "8.8.8.8", count: int = 3) -> Dict[str, Any]:
    try:
        ping_info = _run_cmd(f"ping -n {count} {host}")
        return {
            "ok": True,
            "ping_info": ping_info
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}

def check_proxy() -> Dict[str, Any]:
    try:
        proxy_info = _run_cmd("netsh winhttp show proxy")
        return {
            "ok": True,
            "proxy_info": proxy_info
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}

def execute(action: str = "get_network_info", **kwargs) -> Dict[str, Any]:
    if action == "get_network_info":
        return get_network_info()
    elif action == "list_wifi_networks":
        return list_wifi_networks()
    elif action == "ping_host":
        host = kwargs.get("host", "8.8.8.8")
        count = kwargs.get("count", 3)
        return ping_host(host, count)
    elif action == "check_proxy":
        return check_proxy()
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
