import psutil
import subprocess
import shlex
import sys
from typing import List, Dict
from app.schemas.process_schema import ProcessInfo, ProcessActionType

class OSProcessManager:
    def __init__(self):
        # Lưu các tiến trình con do chính người dùng bật từ giao diện Postman/n8n
        self.managed_subprocesses: Dict[int, subprocess.Popen] = {}

    def list_processes(self, limit: int = 30, sort_by: str = "memory") -> List[ProcessInfo]:
        results: List[ProcessInfo] = []
        # Map sẵn danh sách port đang mở theo PID để không phải query từng process
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

    def control_process(self, pid: int, action: ProcessActionType) -> dict:
        proc = psutil.Process(pid)
        if action == ProcessActionType.KILL:
            proc.kill()
        elif action == ProcessActionType.TERMINATE:
            proc.terminate()
        elif action == ProcessActionType.SUSPEND:
            proc.suspend()
        elif action == ProcessActionType.RESUME:
            proc.resume()
        return {"pid": pid, "action": action.value, "status": "executed"}

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
