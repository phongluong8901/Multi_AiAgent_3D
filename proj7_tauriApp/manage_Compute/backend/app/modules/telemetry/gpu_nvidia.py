"""
Module giám sát và thu thập thông số bộ xử lý đồ họa NVIDIA (NVIDIA GPU Collector).
Sử dụng thư viện pynvml (NVIDIA Management Library) để đo mức tải, dung lượng VRAM, nhiệt độ và công suất.
"""

import pynvml
from typing import List
from app.schemas.telemetry_schema import GpuMetrics

class NvidiaGpuCollector:
    """
    Bộ thu thập trạng thái phần cứng card đồ họa NVIDIA.
    Tự động kiểm tra và xử lý an toàn nếu hệ thống không có GPU NVIDIA hoặc thiếu driver.
    """
    def __init__(self):
        """Khởi tạo kết nối với driver NVML và đếm số lượng card đồ họa khả dụng."""
        self.available = False
        self.device_count = 0
        try:
            pynvml.nvmlInit()
            self.device_count = pynvml.nvmlDeviceGetCount()
            self.available = True
        except Exception:
            self.available = False

    def collect_gpus(self) -> List[GpuMetrics]:
        """
        Duyệt qua từng card NVIDIA, truy vấn handle và đọc các chỉ số hiệu năng:
        tên GPU, % tải tính toán, dung lượng VRAM (MB/%), nhiệt độ (độ C) và công suất (Watts).

        Returns:
            Danh sách đối tượng GpuMetrics cho từng card đồ họa.
        """
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
