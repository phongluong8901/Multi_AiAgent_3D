import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List

TOOL_SCHEMA = {
    "name": "skill_docker_local_manager",
    "risk_level": "confirm",
    "description": (
        "Quản lý Docker Desktop: tự khởi động Docker Desktop nếu chưa mở (`start_docker_desktop`), "
        "liệt kê container đang chạy (`list_containers`, tự động bật Docker Desktop nếu daemon đang tắt), "
        "dừng toàn bộ container đang chạy (`stop_all_running`), "
        "xem danh sách images (`list_images`), xem log container (`container_logs`) và khởi động/dừng 1 hoặc nhiều container (`control_container`)."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["start_docker_desktop", "list_containers", "stop_all_running", "list_images", "container_logs", "control_container"]
            },
            "all_containers": {
                "type": "boolean",
                "default": True
            },
            "auto_start": {
                "type": "boolean",
                "default": True,
                "description": "Tự động mở Docker Desktop nếu Docker Daemon chưa chạy (mặc định: True)."
            },
            "tail": {
                "type": "integer",
                "default": 50
            },
            "container": {
                "type": "string",
                "description": "Tên/ID container, danh sách cách nhau dấu phẩy, hoặc 'all' để thao tác tất cả container đang chạy."
            },
            "op": {
                "type": "string",
                "enum": ["start", "stop", "restart"],
                "default": "restart"
            },
            "dry_run": {
                "type": "boolean",
                "default": False
            }
        },
        "required": ["action"]
    }
}


def _find_docker_desktop() -> str | None:
    candidates = [
        Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Docker" / "Docker" / "Docker Desktop.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Docker" / "Docker Desktop.exe",
        Path(os.environ.get("PROGRAMDATA", r"C:\ProgramData")) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Docker Desktop.lnk",
        Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Docker Desktop.lnk",
        Path.home() / "Desktop" / "Docker Desktop.lnk",
    ]
    for c in candidates:
        try:
            if c.exists():
                return str(c)
        except OSError:
            continue
    return None


def _is_daemon_ready() -> bool:
    try:
        r = subprocess.run(
            ["docker", "info"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=5,
        )
        return r.returncode == 0
    except Exception:
        return False


def start_docker_desktop(wait_sec: float = 20.0) -> Dict[str, Any]:
    if _is_daemon_ready():
        return {"ok": True, "already_running": True, "daemon_ready": True}
    exe = _find_docker_desktop()
    if not exe:
        return {"ok": False, "error": "Không tìm thấy Docker Desktop.exe trên máy Windows."}
    try:
        os.startfile(exe)
    except Exception as exc:
        return {"ok": False, "error": f"Không thể mở Docker Desktop ({exe}): {exc}"}

    deadline = time.monotonic() + max(0.0, float(wait_sec))
    while time.monotonic() < deadline:
        time.sleep(2.0)
        if _is_daemon_ready():
            return {"ok": True, "launched": exe, "daemon_ready": True}
    return {
        "ok": True,
        "launched": exe,
        "daemon_ready": False,
        "message": "Đã khởi chạy Docker Desktop nhưng Docker Engine vẫn đang khởi động (vui lòng đợi thêm vài giây rồi hỏi lại).",
    }


def execute(action: str = "list_containers", **kwargs) -> Dict[str, Any]:
    try:
        if action == "start_docker_desktop":
            return start_docker_desktop(wait_sec=float(kwargs.get("wait_sec", 20.0)))
        if action == "stop_all_running":
            return stop_all_running(dry_run=bool(kwargs.get("dry_run", False)))
        if action == "list_containers":
            return list_containers(
                all_containers=kwargs.get("all_containers", True),
                auto_start=bool(kwargs.get("auto_start", True)),
            )
        elif action == "list_images":
            return list_images()
        elif action == "container_logs":
            container = kwargs.get("container")
            tail = kwargs.get("tail", 50)
            if not container:
                return {"ok": False, "error": "Container name is required for container_logs"}
            return container_logs(container, tail)
        elif action == "control_container":
            container = str(kwargs.get("container") or "").strip()
            op = str(kwargs.get("op") or "restart").strip().lower()
            dry_run = bool(kwargs.get("dry_run", False))
            if (not container or container.lower() in ("all", "*")) and op == "stop":
                return stop_all_running(dry_run=dry_run)
            if not container:
                return {"ok": False, "error": "Container name is required for control_container (hoặc dùng action='stop_all_running')."}
            return control_container(container, op, dry_run)
        else:
            return {"ok": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def list_containers(all_containers: bool = True, auto_start: bool = True) -> Dict[str, Any]:
    cmd = ["docker", "ps", "-a"] if all_containers else ["docker", "ps"]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15)
    if result.returncode == 0:
        return {"ok": True, "data": result.stdout}

    err = (result.stderr or result.stdout or "").strip()
    daemon_down = any(k in err.lower() for k in ("dockerdesktoplinuxengine", "docker_engine", "cannot find the file", "daemon"))
    if daemon_down and auto_start:
        started = start_docker_desktop(wait_sec=20.0)
        if not started.get("ok"):
            return {"ok": False, "error": f"Docker Daemon đang tắt và không thể tự mở Docker Desktop: {started.get('error')}"}
        if started.get("daemon_ready"):
            retry = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15)
            if retry.returncode == 0:
                return {"ok": True, "docker_desktop_launched": True, "data": retry.stdout}
        return {
            "ok": True,
            "docker_desktop_launched": True,
            "daemon_ready": False,
            "launched_path": started.get("launched", ""),
            "message": "Đã tự động khởi chạy ứng dụng Docker Desktop. Engine đang khởi động (thường mất 15-30 giây), hãy kiểm tra lại container sau vài giây.",
        }
    return {"ok": False, "error": err}

def list_images() -> Dict[str, Any]:
    try:
        import subprocess
        result = subprocess.run(["docker", "images"], capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
        return {"ok": True, "data": result.stdout}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": e.stderr}

def container_logs(container: str, tail: int = 50) -> Dict[str, Any]:
    try:
        import subprocess
        result = subprocess.run(["docker", "logs", "--tail", str(tail), container], capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
        return {"ok": True, "data": result.stdout}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": e.stderr}

def stop_all_running(dry_run: bool = False) -> Dict[str, Any]:
    ps = subprocess.run(
        ["docker", "ps", "--format", "{{.Names}}"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=15,
    )
    if ps.returncode != 0:
        return {"ok": False, "error": (ps.stderr or ps.stdout or "Failed to list running containers").strip()}
    running = [ln.strip() for ln in (ps.stdout or "").splitlines() if ln.strip()]
    if not running:
        return {"ok": True, "stopped": [], "count": 0, "message": "Không có container nào đang chạy."}
    if dry_run:
        return {"ok": True, "preview": f"docker stop {' '.join(running)}", "containers": running}
    res = subprocess.run(
        ["docker", "stop", *running],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=60,
    )
    if res.returncode != 0:
        return {"ok": False, "error": (res.stderr or res.stdout or "docker stop failed").strip()}
    return {"ok": True, "stopped": running, "count": len(running), "data": (res.stdout or "").strip()}


def control_container(container: str, op: str = "restart", dry_run: bool = False) -> Dict[str, Any]:
    targets = [c.strip() for c in str(container).replace(",", " ").split() if c.strip()]
    if not targets:
        return {"ok": False, "error": "No container specified"}
    if dry_run:
        return {"ok": True, "data": f"Preview: docker {op} {' '.join(targets)}"}
    result = subprocess.run(
        ["docker", op, *targets],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=60,
    )
    if result.returncode != 0:
        return {"ok": False, "error": (result.stderr or result.stdout or "").strip()}
    return {"ok": True, "op": op, "containers": targets, "data": (result.stdout or "").strip()}
