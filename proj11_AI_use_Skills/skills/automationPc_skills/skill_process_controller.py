"""Windows Process Controller: find by name or port, safely kill hung non-critical processes."""
from typing import Any

PROTECTED_PROCESSES = {
    "system", "idle", "smss.exe", "csrss.exe", "wininit.exe",
    "services.exe", "lsass.exe", "winlogon.exe", "explorer.exe", "svchost.exe",
}

class ProcessControllerClient:
    """Class quản lý và điều khiển tiến trình trên hệ thống Windows."""

    def __init__(self, output_dir: str = "outputs") -> None:
        self.output_dir = output_dir

    def find_process(self, name_query: str = "") -> dict[str, Any]:
        """Tìm kiếm các tiến trình đang chạy theo tên."""
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
            raise RuntimeError("Missing package psutil (pip install psutil)")

    def get_pid_by_port(self, port: int = 8000) -> dict[str, Any]:
        """Tìm PID chiếm dụng cổng TCP."""
        port_num = int(port)
        try:
            import psutil  # type: ignore
            hits = []
            for c in psutil.net_connections(kind="inet"):
                if c.laddr and c.laddr.port == port_num:
                    name = ""
                    try:
                        name = psutil.Process(c.pid).name() if c.pid else ""
                    except Exception:
                        pass
                    hits.append({"pid": c.pid, "name": name, "status": str(c.status), "address": f"{c.laddr.ip}:{c.laddr.port}"})
            return {"ok": True, "port": port_num, "matches": hits}
        except ImportError:
            raise RuntimeError("Missing package psutil (pip install psutil)")

    def kill_process(self, pid: int, force: bool = False, dry_run: bool = True) -> dict[str, Any]:
        """Tắt tiến trình theo PID một cách an toàn."""
        pid_num = int(pid)
        if pid_num <= 4:
            return {"ok": False, "error": f"Refused to terminate protected system PID {pid_num}"}
        try:
            import psutil  # type: ignore
            proc = psutil.Process(pid_num)
            pname = proc.name()
            if pname.lower() in PROTECTED_PROCESSES:
                return {"ok": False, "error": f"Refused to terminate critical Windows process: {pname} (PID {pid_num})"}
            if dry_run:
                return {"ok": True, "dry_run": True, "pid": pid_num, "name": pname, "planned_action": "kill" if force else "terminate"}
            if force:
                proc.kill()
            else:
                proc.terminate()
            return {"ok": True, "dry_run": False, "pid": pid_num, "name": pname, "terminated": True}
        except ImportError:
            raise RuntimeError("Missing package psutil (pip install psutil)")

    def execute(self, action: str = "find_process", **kwargs: Any) -> dict[str, Any]:
        """Thực thi các hành động điều khiển tiến trình (find_process, get_pid_by_port, kill_process)."""
        act = (action or "find_process").strip().lower()
        try:
            if act == "find_process":
                return self.find_process(kwargs.get("name_query", ""))
            if act == "get_pid_by_port":
                return self.get_pid_by_port(kwargs.get("port", 8000))
            if act == "kill_process":
                pid = kwargs.get("pid")
                if pid is None:
                    name_query = kwargs.get("name_query")
                    if name_query:
                        find_res = self.find_process(name_query)
                        if find_res.get("ok") and find_res.get("processes"):
                            matched = find_res["processes"]
                            if len(matched) == 1:
                                pid = matched[0]["pid"]
                            else:
                                return {
                                    "ok": False,
                                    "error": f"Found multiple processes matching '{name_query}'. Please specify 'pid'.",
                                    "matches": matched[:10]
                                }
                    if pid is None:
                        return {"ok": False, "error": "Missing required parameter: pid"}
                return self.kill_process(int(pid), force=kwargs.get("force", False), dry_run=kwargs.get("dry_run", True))
            return {"ok": False, "error": f"Unknown action: {action}"}
        except Exception as e:
            return {"ok": False, "error": f"{type(e).__name__}: {e}"}
