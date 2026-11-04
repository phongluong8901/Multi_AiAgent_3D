import psutil
import subprocess
import shlex
import sys
from typing import List, Dict
from app.schemas.process_schema import ProcessInfo, ProcessActionType

class OSProcessManager:
    def __init__(self):
        # Lưu các tiến trình con do người dùng bật từ giao diện Studio
        self.managed_subprocesses: Dict[int, subprocess.Popen] = {}

    def list_processes(self, limit: int = 30, sort_by: str = "memory") -> List[ProcessInfo]:
        results: List[ProcessInfo] = []
        pid_ports: Dict[int, List[int]] = {}
        try:
            for conn in psutil.net_connections(kind='inet'):
                if conn.status == 'LISTEN' and conn.pid and conn.laddr:
                    port = getattr(conn.laddr, "port", None)
                    if port is None and isinstance(conn.laddr, (tuple, list)) and len(conn.laddr) > 1:
                        port = conn.laddr[1]
                    if port and isinstance(port, int):
                        pid_ports.setdefault(conn.pid, []).append(port)
        except Exception:
            pass

        attrs = ['pid', 'name', 'username', 'status', 'cpu_percent', 'memory_percent', 'memory_info', 'num_threads', 'cmdline']
        for proc in psutil.process_iter(attrs=attrs):
            try:
                info = proc.info
                mem_info = info.get('memory_info')
                rss = getattr(mem_info, 'rss', 0) if mem_info else 0
                mem_mb = round(float(rss) / (1024**2), 1)

                results.append(ProcessInfo(
                    pid=info['pid'],
                    name=info['name'] or "Unknown",
                    username=info.get('username'),
                    status=info.get('status') or "unknown",
                    cpu_percent=round(float(info.get('cpu_percent') or 0.0), 1),
                    memory_percent=round(float(info.get('memory_percent') or 0.0), 2),
                    memory_mb=mem_mb,
                    num_threads=int(info.get('num_threads') or 0),
                    cmdline=info.get('cmdline') or [],
                    open_ports=list(set(pid_ports.get(info['pid'], [])))
                ))
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue

        if sort_by == "cpu":
            results.sort(key=lambda x: x.cpu_percent, reverse=True)
        else:
            results.sort(key=lambda x: x.memory_mb, reverse=True)

        return results[:limit]

    def control_process(self, pid: int, action: ProcessActionType | str) -> dict:
        proc = psutil.Process(pid)
        act_val = action.value if hasattr(action, "value") else str(action)

        if act_val in ["kill", ProcessActionType.KILL]:
            proc.kill()
        elif act_val in ["terminate", ProcessActionType.TERMINATE]:
            proc.terminate()
        elif act_val in ["suspend", ProcessActionType.SUSPEND]:
            proc.suspend()
        elif act_val in ["resume", ProcessActionType.RESUME]:
            proc.resume()
        elif act_val in ["trim_memory", "empty_working_set"]:
            return self.trim_process_memory(pid)
        return {"pid": pid, "action": act_val, "status": "executed"}

    def trim_process_memory(self, pid: int) -> dict:
        """
        Thu hồi Working Set RAM cho tiến trình thông qua Win32 EmptyWorkingSet API.
        Giải phóng RAM rò rỉ / dư thừa ngay lập tức mà không làm tắt hoặc gián đoạn tiến trình.
        """
        if sys.platform == "win32":
            import ctypes
            PROCESS_QUERY_INFORMATION = 0x0400
            PROCESS_SET_QUOTA = 0x0100
            handle = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_SET_QUOTA, False, pid)
            if handle:
                try:
                    success = ctypes.windll.psapi.EmptyWorkingSet(handle)
                    return {"pid": pid, "status": "trimmed", "freed": bool(success)}
                finally:
                    ctypes.windll.kernel32.CloseHandle(handle)
            else:
                return {"pid": pid, "status": "error", "reason": "Could not open process handle (requires permissions)"}
        return {"pid": pid, "status": "skipped", "reason": "EmptyWorkingSet is only available on Windows"}

    def set_process_priority(self, pid: int, priority: str = "idle") -> dict:
        """
        Hạ hoặc nâng mức ưu tiên CPU của tiến trình (IDLE, BELOW_NORMAL, NORMAL, HIGH).
        Giúp tránh khựng đơ giao diện khi tiến trình chạy nặng.
        """
        proc = psutil.Process(pid)
        p_lower = str(priority).lower()
        if sys.platform == "win32":
            mapping = {
                "idle": psutil.IDLE_PRIORITY_CLASS,
                "below_normal": psutil.BELOW_NORMAL_PRIORITY_CLASS,
                "normal": psutil.NORMAL_PRIORITY_CLASS,
                "above_normal": psutil.ABOVE_NORMAL_PRIORITY_CLASS,
                "high": psutil.HIGH_PRIORITY_CLASS,
                "realtime": psutil.REALTIME_PRIORITY_CLASS,
            }
            target_class = mapping.get(p_lower, psutil.BELOW_NORMAL_PRIORITY_CLASS)
            proc.nice(target_class)
        else:
            nice_val = 15 if p_lower in ["idle", "below_normal"] else 0
            proc.nice(nice_val)
        return {"pid": pid, "status": "priority_set", "priority": p_lower}

    def set_process_affinity(self, pid: int, cores: List[int] | None = None) -> dict:
        """
        Gán Core CPU (Affinity) cho tiến trình, giới hạn CPU Cores được phép chạy.
        """
        proc = psutil.Process(pid)
        total_cores = psutil.cpu_count(logical=True) or 4
        if not cores:
            cores = [0, 1] if total_cores > 1 else [0]
        valid_cores = [c for c in cores if 0 <= c < total_cores]
        proc.cpu_affinity(valid_cores)
        return {"pid": pid, "status": "affinity_set", "cores": valid_cores}

    def release_port(self, port: int) -> dict:
        """
        Quét tìm và giải phóng cổng mạng đang bị chiếm dụng bởi tiến trình treo/xung đột.
        """
        target_pid = None
        try:
            for conn in psutil.net_connections(kind='inet'):
                if conn.status == 'LISTEN' and conn.laddr:
                    p = getattr(conn.laddr, "port", None)
                    if p is None and isinstance(conn.laddr, (tuple, list)) and len(conn.laddr) > 1:
                        p = conn.laddr[1]
                    if p == port and conn.pid:
                        target_pid = conn.pid
                        break
        except Exception:
            pass

        if target_pid:
            try:
                proc = psutil.Process(target_pid)
                pname = proc.name()
                proc.terminate()
                return {"port": port, "status": "released", "terminated_pid": target_pid, "process_name": pname}
            except Exception as e:
                return {"port": port, "status": "error", "reason": str(e), "pid": target_pid}

        return {"port": port, "status": "not_in_use", "reason": f"Port {port} is not occupied"}

    def spawn_managed_service(self, command: str, cwd: str | None = None) -> dict:
        args = shlex.split(command, posix=(sys.platform != "win32"))
        proc = subprocess.Popen(
            args,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        self.managed_subprocesses[proc.pid] = proc
        return {"pid": proc.pid, "command": command, "status": "started"}

process_manager = OSProcessManager()
