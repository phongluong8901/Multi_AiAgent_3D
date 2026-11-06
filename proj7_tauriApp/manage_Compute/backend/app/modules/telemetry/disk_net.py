"""
Module thu thập chỉ số I/O ổ đĩa và lưu lượng mạng hệ thống.
Đo đạc dung lượng ổ đĩa gốc và dung lượng byte truyền/nhận qua card mạng.
"""

import psutil
from app.schemas.telemetry_schema import DiskNetMetrics

class DiskNetCollector:
    """
    Bộ thu thập dữ liệu phân vùng ổ đĩa và băng thông mạng.
    """
    def collect_io(self) -> DiskNetMetrics:
        """
        Đọc tỷ lệ sử dụng ổ đĩa hệ thống và lưu lượng mạng đã gửi/nhận tính bằng MB.

        Returns:
            Đối tượng DiskNetMetrics chứa các thông số I/O.
        """
        disk = psutil.disk_usage('/')
        net = psutil.net_io_counters()
        return DiskNetMetrics(
            disk_usage_percent=float(disk.percent),
            disk_free_gb=round(float(disk.free) / (1024**3), 2),
            net_bytes_sent_mb=round(float(net.bytes_sent) / (1024**2), 2),
            net_bytes_recv_mb=round(float(net.bytes_recv) / (1024**2), 2)
        )
