"""Windows Process Controller: find by name or port, safely kill hung non-critical processes."""
import subprocess
from typing import Any

PROTECTED_PROCESSES = {
    "system", "idle", "smss.exe", "csrss.exe", "wininit.exe",
    "services.exe", "lsass.exe", "winlogon.exe", "explorer.exe", "svchost.exe",
}

TOOL_SCHEMA: dict[str, Any] = {
    "name": "skill_process_controller",
    "description": (
        "Tìm kiếm PID tiến trình theo tên ứng dụng hoặc cổng mạng (port), và tắt (kill) an toàn các ứng dụng bị treo "
        "(tự động chặn tắt tiến trình lõi Windows như lsass, csrss, explorer; mặc định dry_run=True). "
        "Find processes by name or port and safely terminate non-critical processes."
    ),
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["find_process", "get_pid_by_port", "kill_process"]},
            "name_query": {"type": "string", "description": "Tên tiến trình cần tìm (vd: 'chrome', 'python')."},
            "port": {"type": "integer", "description": "Cổng TCP/UDP cần tìm PID chiếm dụng."},
            "pid": {"type": "integer", "description": "PID tiến trình cần tắt."},
            "force": {"type": "boolean", "description": "Ép tắt ngay (kill) thay vì terminate nhẹ."},
            "dry_run": {"type": "boolean", "description": "True = chỉ kiểm tra, chưa tắt thật (mặc định: True)."},
        },
        "required": ["action"],
    },
}


def find_process(name_query: str = "") -> dict[str, Any]:
    q = (name_query or "").strip().lower()
    try:
        import psutil  # type: ignore
        hits = []
        for p in psutil.process_iter(["pid", "name", "memory_info", "status"]):
            try:
                info = p.info
                pname = str(info.get("name") or "")
                if q and q not in pname.lower():
                    continue
                mem_mb = round((info["memory_info"].rss if info.get("memory_info") else 0) / (1024**2), 1)
                hits.append({"pid": info["pid"], "name": pname, "memory_mb": mem_mb, "status": info.get("status", "")})
            except Exception:
                continue
        hits.sort(key=lambda x: x["memory_mb"], reverse=True)
        return {"ok": True, "count": len(hits), "processes": hits[:30]}
    except ImportError:
        return {"ok": False, "error": "Missing package psutil (pip install psutil)"}


def get_pid_by_port(port: int = 8000) -> dict[str, Any]:
    port = int(port)
    try:
        import psutil  # type: ignore
        hits = []
        for c in psutil.net_connections(kind="inet"):
            if c.laddr and c.laddr.port == port:
                name = ""
                try:
                    name = psutil.Process(c.pid).name() if c.pid else ""
                except Exception:
                    pass
                hits.append({"pid": c.pid, "name": name, "status": str(c.status), "address": f"{c.laddr.ip}:{c.laddr.port}"})
        return {"ok": True, "port": port, "matches": hits}
    except ImportError:
        return {"ok": False, "error": "Missing package psutil (pip install psutil)"}


def kill_process(pid: int, force: bool = False, dry_run: bool = True) -> dict[str, Any]:
    pid = int(pid)
    if pid <= 4:
        return {"ok": False, "error": f"Refused to terminate protected system PID {pid}"}
    try:
        import psutil  # type: ignore
        proc = psutil.Process(pid)
        pname = proc.name()
        if pname.lower() in PROTECTED_PROCESSES:
            return {"ok": False, "error": f"Refused to terminate critical Windows process: {pname} (PID {pid})"}
        if dry_run:
            return {"ok": True, "dry_run": True, "pid": pid, "name": pname, "planned_action": "kill" if force else "terminate"}
        if force:
            proc.kill()
        else:
            proc.terminate()
        return {"ok": True, "dry_run": False, "pid": pid, "name": pname, "terminated": True}
    except ImportError:
        if dry_run:
            return {"ok": True, "dry_run": True, "pid": pid, "planned_cmd": f"taskkill /PID {pid}" + (" /F" if force else "")}
        cmd = ["taskkill", "/PID", str(pid)] + (["/F"] if force else [])
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        return {"ok": r.returncode == 0, "pid": pid, "stdout": r.stdout.strip(), "stderr": r.stderr.strip()}


def execute(action: str = "find_process", **kwargs: Any) -> dict[str, Any]:
    act = (action or "find_process").strip().lower()
    try:
        if act == "find_process":
            return find_process(kwargs.get("name_query", ""))
        if act == "get_pid_by_port":
            return get_pid_by_port(kwargs.get("port", 8000))
        if act == "kill_process":
            if "pid" not in kwargs or kwargs["pid"] is None:
                return {"ok": False, "error": "Missing required parameter: pid"}
            return kill_process(int(kwargs["pid"]), force=kwargs.get("force", False), dry_run=kwargs.get("dry_run", True))
        return {"ok": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
