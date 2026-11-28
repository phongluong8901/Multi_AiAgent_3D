"""SSH Config Parser, Port 22 Reachability Tester, and SCP Command Builder."""
import os
import socket
from typing import Any

TOOL_SCHEMA: dict[str, Any] = {
    "name": "skill_ssh_remote_helper",
    "description": (
        "Quản lý kết nối SSH tới máy chủ Linux / Orange Pi: đọc danh sách host trong ~/.ssh/config, "
        "kiểm tra cổng SSH (port 22) có đang mở hay không, và tạo lệnh SCP tải lên/tải xuống file an toàn. "
        "SSH remote helper: list_ssh_hosts, check_ssh_port, build_scp_cmd."
    ),
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["list_ssh_hosts", "check_ssh_port", "build_scp_cmd"]},
            "config_path": {"type": "string", "description": "Đường dẫn tệp ssh config (mặc định: ~/.ssh/config)."},
            "host": {"type": "string", "description": "Địa chỉ IP hoặc domain máy chủ SSH."},
            "port": {"type": "integer", "description": "Cổng SSH (mặc định: 22)."},
            "timeout": {"type": "number", "description": "Thời gian chờ kiểm tra TCP (giây)."},
            "local_path": {"type": "string", "description": "Đường dẫn tệp trên máy Windows."},
            "remote_target": {"type": "string", "description": "Đích từ xa dạng user@host:/path."},
            "direction": {"type": "string", "enum": ["upload", "download"], "description": "Chiều truyền file SCP."},
        },
        "required": ["action"],
    },
}


def list_ssh_hosts(config_path: str = "") -> dict[str, Any]:
    path = os.path.expanduser(config_path or "~/.ssh/config")
    if not os.path.isfile(path):
        return {"ok": True, "config_path": path, "hosts": [], "note": "SSH config file does not exist yet."}
    hosts: list[dict[str, str]] = []
    cur: dict[str, str] | None = None
    for raw in open(path, "r", encoding="utf-8", errors="ignore"):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(None, 1)
        if len(parts) < 2:
            continue
        key, val = parts[0].lower(), parts[1].strip()
        if key == "host":
            if cur:
                hosts.append(cur)
            cur = {"alias": val}
        elif cur is not None and key in ("hostname", "user", "port", "identityfile"):
            cur[key] = val
    if cur:
        hosts.append(cur)
    return {"ok": True, "config_path": path, "count": len(hosts), "hosts": hosts}


def check_ssh_port(host: str, port: int = 22, timeout: float = 3.0) -> dict[str, Any]:
    if not (host or "").strip():
        return {"ok": False, "error": "Missing host"}
    try:
        with socket.create_connection((host.strip(), int(port or 22)), timeout=float(timeout or 3.0)):
            return {"ok": True, "host": host.strip(), "port": int(port or 22), "reachable": True}
    except OSError as e:
        return {"ok": True, "host": host.strip(), "port": int(port or 22), "reachable": False, "reason": str(e)}


def build_scp_cmd(local_path: str, remote_target: str, direction: str = "upload", port: int = 22) -> dict[str, Any]:
    if not local_path or not remote_target:
        return {"ok": False, "error": "Both local_path and remote_target are required"}
    p_flag = f"-P {int(port)} " if int(port or 22) != 22 else ""
    if (direction or "upload").lower() == "download":
        cmd = f'scp {p_flag}"{remote_target}" "{local_path}"'
    else:
        cmd = f'scp {p_flag}"{local_path}" "{remote_target}"'
    return {"ok": True, "direction": direction, "command": cmd}


def execute(action: str = "list_ssh_hosts", **kwargs: Any) -> dict[str, Any]:
    act = (action or "list_ssh_hosts").strip().lower()
    try:
        if act == "list_ssh_hosts":
            return list_ssh_hosts(kwargs.get("config_path", ""))
        if act == "check_ssh_port":
            return check_ssh_port(kwargs.get("host", ""), kwargs.get("port", 22), kwargs.get("timeout", 3.0))
        if act == "build_scp_cmd":
            return build_scp_cmd(kwargs.get("local_path", ""), kwargs.get("remote_target", ""), kwargs.get("direction", "upload"), kwargs.get("port", 22))
        return {"ok": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
