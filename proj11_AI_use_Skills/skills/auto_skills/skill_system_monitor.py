"""Module for monitoring system hardware resources and processes using safe fallback mechanisms."""

class SystemMonitorClient:
    """Client for monitoring system hardware resources (CPU, RAM) and processes."""

    def __init__(self):
        """Initialize the SystemMonitorClient."""
        pass

    def get_system_hardware_info(self) -> dict:
        """Get overall system CPU and RAM usage statistics."""
        try:
            import psutil
            cpu_percent = psutil.cpu_percent(interval=0.1)
            cpu_count = psutil.cpu_count(logical=True) or 1
            
            virtual_mem = psutil.virtual_memory()
            ram_total_gb = round(virtual_mem.total / (1024 ** 3), 2)
            ram_used_gb = round(virtual_mem.used / (1024 ** 3), 2)
            ram_percent = virtual_mem.percent
        except (ImportError, Exception):
            cpu_percent = 0.0
            cpu_count = 1
            ram_total_gb = 0.0
            ram_used_gb = 0.0
            ram_percent = 0.0

        return {
            "cpu_usage_percent": cpu_percent,
            "cpu_cores": cpu_count,
            "ram_total_gb": ram_total_gb,
            "ram_used_gb": ram_used_gb,
            "ram_usage_percent": ram_percent
        }

    def get_top_resource_processes(self, limit: int = 5) -> list[dict]:
        """List top processes consuming the most CPU and RAM resources on the system."""
        processes = []
        try:
            import psutil
            for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
                try:
                    pinfo = proc.info
                    if not pinfo:
                        continue
                    pinfo['cpu_percent'] = pinfo.get('cpu_percent') or 0.0
                    pinfo['memory_percent'] = pinfo.get('memory_percent') or 0.0
                    processes.append(pinfo)
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess, Exception):
                    pass
        except (ImportError, Exception):
            pass

        sorted_processes = sorted(processes, key=lambda x: x.get('memory_percent', 0.0), reverse=True)
        
        top_processes = []
        for p in sorted_processes[:limit]:
            top_processes.append({
                "pid": p.get("pid"),
                "name": p.get("name"),
                "cpu_percent": round(p.get("cpu_percent", 0.0), 1),
                "memory_percent": round(p.get("memory_percent", 0.0), 2)
            })

        return top_processes
