import psutil
from app.schemas.telemetry_schema import DiskNetMetrics

class DiskNetCollector:
    def collect_io(self) -> DiskNetMetrics:
        disk = psutil.disk_usage('/')
        net = psutil.net_io_counters()
        return DiskNetMetrics(
            disk_usage_percent=float(disk.percent),
            disk_free_gb=round(float(disk.free) / (1024**3), 2),
            net_bytes_sent_mb=round(float(net.bytes_sent) / (1024**2), 2),
            net_bytes_recv_mb=round(float(net.bytes_recv) / (1024**2), 2)
        )
