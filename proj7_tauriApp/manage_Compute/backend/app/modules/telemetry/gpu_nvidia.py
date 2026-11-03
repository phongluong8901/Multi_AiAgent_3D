import pynvml
from typing import List
from app.schemas.telemetry_schema import GpuMetrics

class NvidiaGpuCollector:
    def __init__(self):
        self.available = False
        self.device_count = 0
        try:
            pynvml.nvmlInit()
            self.device_count = pynvml.nvmlDeviceGetCount()
            self.available = True
        except Exception:
            self.available = False

    def collect_gpus(self) -> List[GpuMetrics]:
        if not self.available:
            return []

        gpus: List[GpuMetrics] = []
        for i in range(self.device_count):
            try:
                handle = pynvml.nvmlDeviceGetHandleByIndex(i)
                name = pynvml.nvmlDeviceGetName(handle)
                if isinstance(name, bytes):
                    name = name.decode("utf-8")

                mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
                util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)

                try:
                    power_mw = pynvml.nvmlDeviceGetPowerUsage(handle)
                    power_w = round(float(power_mw) / 1000.0, 1)
                except Exception:
                    power_w = None

                used_bytes = float(getattr(mem, "used", 0))
                total_bytes = float(getattr(mem, "total", 0))
                mem_used_mb = round(used_bytes / (1024**2), 1)
                mem_total_mb = round(total_bytes / (1024**2), 1)
                mem_percent = round((used_bytes / total_bytes) * 100, 1) if total_bytes > 0 else 0.0

                gpus.append(GpuMetrics(
                    id=i,
                    name=name,
                    load_percent=float(getattr(util, "gpu", 0.0)),
                    memory_used_mb=mem_used_mb,
                    memory_total_mb=mem_total_mb,
                    memory_percent=mem_percent,
                    temp_c=float(temp),
                    power_watts=power_w
                ))
            except Exception:
                continue
        return gpus
