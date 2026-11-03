import time
from app.schemas.telemetry_schema import SystemSnapshot
from app.modules.telemetry.cpu_ram import CpuRamCollector
from app.modules.telemetry.gpu_nvidia import NvidiaGpuCollector
from app.modules.telemetry.disk_net import DiskNetCollector

class MasterTelemetryCollector:
    def __init__(self):
        self.cpu_ram = CpuRamCollector()
        self.gpu = NvidiaGpuCollector()
        self.io = DiskNetCollector()

    def get_snapshot(self) -> SystemSnapshot:
        return SystemSnapshot(
            timestamp=time.time(),
            cpu=self.cpu_ram.collect_cpu(),
            ram=self.cpu_ram.collect_ram(),
            gpus=self.gpu.collect_gpus(),
            io=self.io.collect_io()
        )

telemetry_collector = MasterTelemetryCollector()