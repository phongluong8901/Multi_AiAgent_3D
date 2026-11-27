"""Windows System & Process Monitor (CPU, RAM, Disk, Top memory/CPU apps, Open ports)."""
import json
import subprocess
from typing import Any

TOOL_SCHEMA: dict[str, Any] = {
    "name": "skill_system_monitor",
    "description": (
        "Xem thông số hệ thống thời gian thực trên Windows: mức sử dụng CPU, RAM, ổ đĩa, pin, "
        "liệt kê top ứng dụng/tiến trình ngốn RAM hoặc CPU nhất hiện tại, và kiểm tra cổng mạng (port) đang mở. "
        "Real-time Windows system monitor: CPU, RAM, disk usage, top memory/CPU processes, open ports."
    ),
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["get_overview", "list_top_processes", "check_port", "full_report"],
                "description": "Thao tác cần chạy (mặc định: full_report gồm cả RAM/CPU và top app ngốn RAM).",
            },
            "limit": {
                "type": "integer",
                "description": "Số lượng ứng dụng/tiến trình muốn lấy (mặc định: 5).",
            },
            "sort_by": {
                "type": "string",
                "enum": ["memory", "cpu"],
                "description": "Sắp xếp tiến trình theo 'memory' (RAM) hoặc 'cpu' (mặc định: memory).",
            },
            "port": {
                "type": "integer",
                "description": "Số cổng TCP/UDP cần kiểm tra khi action='check_port'.",
            },
        },
        "required": ["action"],
    },
}


def _ps_json(ps_cmd: str, timeout: int = 15) -> Any:
    full = f"[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; {ps_cmd}"
    proc = subprocess.run(
        ["powershell", "-NoProfile", "-Command", full],
        capture_output=True,
        text=True, encoding="utf-8", errors="replace",
        timeout=timeout,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or f"PowerShell exited {proc.returncode}")
    out = proc.stdout.strip()
    return json.loads(out) if out else []


def get_overview() -> dict[str, Any]:
    try:
        import psutil  # type: ignore
        vm = psutil.virtual_memory()
        cpu_pct = psutil.cpu_percent(interval=0.4)
        disks = []
        for p in psutil.disk_partitions(all=False):
            try:
                u = psutil.disk_usage(p.mountpoint)
                disks.append({
                    "mount": p.mountpoint,
                    "total_gb": round(u.total / (1024**3), 2),
                    "used_gb": round(u.used / (1024**3), 2),
                    "free_gb": round(u.free / (1024**3), 2),
                    "percent": u.percent,
                })
            except Exception:
                continue
        return {
            "ok": True,
            "cpu_percent": cpu_pct,
            "cpu_cores_logical": psutil.cpu_count(logical=True),
            "ram_total_gb": round(vm.total / (1024**3), 2),
            "ram_used_gb": round(vm.used / (1024**3), 2),
            "ram_available_gb": round(vm.available / (1024**3), 2),
            "ram_percent": vm.percent,
            "disks": disks,
            "backend": "psutil",
        }
    except ImportError:
        data = _ps_json(
            "$os=Get-CimInstance Win32_OperatingSystem;"
            "$cpu=(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average;"
            "@{cpu_percent=$cpu; ram_total_gb=[math]::Round($os.TotalVisibleMemorySize/1MB,2); "
            "ram_free_gb=[math]::Round($os.FreePhysicalMemory/1MB,2)} | ConvertTo-Json"
        )
        return {"ok": True, **data, "backend": "powershell"}


def list_top_processes(limit: int = 5, sort_by: str = "memory") -> dict[str, Any]:
    limit = max(1, min(int(limit or 5), 50))
    sort_by = (sort_by or "memory").lower()
    try:
        import psutil  # type: ignore
        procs = []
        for p in psutil.process_iter(["pid", "name", "memory_info", "cpu_percent"]):
            try:
                info = p.info
                mem_mb = round((info["memory_info"].rss if info.get("memory_info") else 0) / (1024**2), 1)
                procs.append({
                    "pid": info["pid"],
                    "name": info["name"] or "unknown",
                    "memory_mb": mem_mb,
                    "cpu_percent": round(float(info.get("cpu_percent") or 0.0), 1),
                })
            except Exception:
                continue
        key = "cpu_percent" if sort_by == "cpu" else "memory_mb"
        procs.sort(key=lambda x: x[key], reverse=True)
        return {"ok": True, "sort_by": sort_by, "processes": procs[:limit], "backend": "psutil"}
    except ImportError:
        prop = "CPU" if sort_by == "cpu" else "WorkingSet64"
        rows = _ps_json(
            f"Get-Process | Sort-Object {prop} -Descending | Select-Object -First {limit} "
            "Id,ProcessName,@{N='memory_mb';E={[math]::Round($_.WorkingSet64/1MB,1)}},@{N='cpu_sec';E={[math]::Round($_.CPU,1)}} | ConvertTo-Json"
        )
        if isinstance(rows, dict):
            rows = [rows]
        return {"ok": True, "sort_by": sort_by, "processes": rows, "backend": "powershell"}


def check_port(port: int) -> dict[str, Any]:
    port = int(port)
    try:
        import psutil  # type: ignore
        hits = []
        for c in psutil.net_connections(kind="inet"):
            if c.laddr and c.laddr.port == port:
                hits.append({"pid": c.pid, "status": str(c.status), "local": f"{c.laddr.ip}:{c.laddr.port}"})
        return {"ok": True, "port": port, "in_use": bool(hits), "connections": hits}
    except Exception as e:
        return {"ok": False, "port": port, "error": str(e)}


def execute(action: str = "full_report", **kwargs: Any) -> dict[str, Any]:
    act = (action or "full_report").strip().lower()
    try:
        if act == "get_overview":
            return get_overview()
        if act == "list_top_processes":
            return list_top_processes(limit=kwargs.get("limit", 5), sort_by=kwargs.get("sort_by", "memory"))
        if act == "full_report":
            ov = get_overview()
            top = list_top_processes(limit=kwargs.get("limit", 5), sort_by=kwargs.get("sort_by", "memory"))
            return {"ok": True, "overview": ov, "top_processes": top.get("processes", [])}
        if act == "check_port":
            if "port" not in kwargs or kwargs["port"] is None:
                return {"ok": False, "error": "Missing required parameter: port"}
            return check_port(int(kwargs["port"]))
        return {"ok": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
