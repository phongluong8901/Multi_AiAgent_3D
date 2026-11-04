import time
from app.schemas.telemetry_schema import SystemSnapshot
from app.modules.telemetry.cpu_ram import CpuRamCollector
from app.modules.telemetry.gpu_nvidia import NvidiaGpuCollector
from app.modules.telemetry.disk_net import DiskNetCollector
from app.modules.service_manager.os_process import process_manager

class MasterTelemetryCollector:
    def __init__(self):
        self.cpu_ram = CpuRamCollector()
        self.gpu = NvidiaGpuCollector()
        self.io = DiskNetCollector()

    def get_snapshot(self) -> SystemSnapshot:
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

telemetry_collector = MasterTelemetryCollector()
