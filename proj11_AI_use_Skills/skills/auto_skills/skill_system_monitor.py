import os
import psutil

class SystemMonitorClient:
    """Client for monitoring system network connections, listening ports, and owning processes on Windows."""

    def __init__(self, output_dir: str = "outputs"):
        self.output_dir = output_dir
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir, exist_ok=True)

    def _get_process_name(self, pid: int) -> str:
        """Helper method to safely retrieve process name by PID."""
        if not pid:
            return "System/Unknown"
        try:
            p = psutil.Process(pid)
            return p.name()
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            return "Unknown"

    def get_network_connections_summary(self) -> dict:
        """Get summary statistics of network connections on the system."""
        try:
            conns = psutil.net_connections(kind='inet')
            status_counts = {}
            for c in conns:
                status = c.status
                status_counts[status] = status_counts.get(status, 0) + 1

            return {
                "total_connections": len(conns),
                "status_breakdown": status_counts
            }
        except Exception as e:
            raise RuntimeError(f"Failed to retrieve network connections: {str(e)}")

    def get_listening_ports(self) -> list[dict]:
        """Get a list of all network ports currently in LISTEN state along with their owning processes."""
        try:
            conns = psutil.net_connections(kind='inet')
            results = []
            for c in conns:
                if c.status == psutil.CONN_LISTEN:
                    laddr = c.laddr
                    pid = c.pid
                    proc_name = self._get_process_name(pid)
                    results.append({
                        "ip": laddr.ip if laddr else "",
                        "port": laddr.port if laddr else 0,
                        "family": str(c.family),
                        "type": str(c.type),
                        "pid": pid,
                        "process_name": proc_name
                    })
            return results
        except Exception as e:
            raise RuntimeError(f"Failed to retrieve listening ports: {str(e)}")

    def get_established_connections(self) -> list[dict]:
        """Get a list of all active TCP ESTABLISHED connections along with their owning processes."""
        try:
            conns = psutil.net_connections(kind='inet')
            results = []
            for c in conns:
                if c.status == psutil.CONN_ESTABLISHED:
                    laddr = c.laddr
                    raddr = c.raddr
                    pid = c.pid
                    proc_name = self._get_process_name(pid)
                    results.append({
                        "local_ip": laddr.ip if laddr else "",
                        "local_port": laddr.port if laddr else 0,
                        "remote_ip": raddr.ip if raddr else "",
                        "remote_port": raddr.port if raddr else 0,
                        "pid": pid,
                        "process_name": proc_name
                    })
            return results
        except Exception as e:
            raise RuntimeError(f"Failed to retrieve established connections: {str(e)}")
