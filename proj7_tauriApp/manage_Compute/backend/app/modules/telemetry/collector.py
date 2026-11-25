"""
Module điều phối thu thập telemetry tổng hợp (Master Telemetry Collector).
Hợp nhất dữ liệu từ CpuRamCollector, NvidiaGpuCollector, DiskNetCollector và ProcessManager
thành một SystemSnapshot toàn diện theo thời gian thực.
"""

import time
from app.schemas.telemetry_schema import SystemSnapshot
from app.modules.telemetry.cpu_ram import CpuRamCollector
from app.modules.telemetry.gpu_nvidia import NvidiaGpuCollector
from app.modules.telemetry.disk_net import DiskNetCollector
from app.modules.service_manager.os_process import process_manager

class MasterTelemetryCollector:
    """
    Lớp tập trung quản lý các bộ thu thập thành phần và kết xuất ảnh chụp hệ thống (Snapshot).
    """
    def __init__(self):
        """Khởi tạo các collector thành phần: CPU/RAM, GPU NVIDIA và I/O mạng/đĩa."""
        self.cpu_ram = CpuRamCollector()
        self.gpu = NvidiaGpuCollector()
        self.io = DiskNetCollector()

    def get_snapshot(self) -> SystemSnapshot:
        """
        Thu thập toàn bộ chỉ số phần cứng và top 25 tiến trình tiêu tốn nhiều bộ nhớ nhất.

        Returns:
            Đối tượng SystemSnapshot hoàn chỉnh kèm dấu thời gian unix.
        """
        try:
            procs = process_manager.list_processes(limit=25, sort_by="memory")
        except Exception:
            procs = []

        return SystemSnapshot(
            timestamp=time.time(),
            cpu=self.cpu_ram.collect_cpu(),
            ram=self.cpu_ram.collect_ram(),
            gpus=self.gpu.collect_gpus(),
            io=self.io.collect_io(),
            processes=procs
        )

# Instance duy nhất của collector toàn cục
telemetry_collector = MasterTelemetryCollector()
