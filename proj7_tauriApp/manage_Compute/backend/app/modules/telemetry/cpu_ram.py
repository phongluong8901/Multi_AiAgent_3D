import psutil
from app.schemas.telemetry_schema import CpuMetrics, RamMetrics

class CpuRamCollector:
    def __init__(self):
        try:
            psutil.cpu_percent(interval=None)
            psutil.cpu_percent(interval=None, percpu=True)
        except Exception:
            pass

    def collect_cpu(self) -> CpuMetrics:
        freq_cur = 0.0
        freq_max = 0.0
        try:
            freq = psutil.cpu_freq()
            if freq:
                freq_cur = round(float(freq.current), 1)
                freq_max = round(float(freq.max), 1)
        except Exception:
            pass

        try:
            cpu_pct = float(psutil.cpu_percent(interval=None))
            per_core = [float(p) for p in psutil.cpu_percent(interval=None, percpu=True)]
        except Exception:
            cpu_pct = 0.0
            per_core = []

        return CpuMetrics(
            percent=cpu_pct,
            per_core=per_core,
            freq_current_mhz=freq_cur,
            freq_max_mhz=freq_max,
            logical_cores=int(psutil.cpu_count(logical=True) or 1),
            physical_cores=psutil.cpu_count(logical=False)
        )

    def collect_ram(self) -> RamMetrics:
        vm = psutil.virtual_memory()
        swap_percent = 0.0
        try:
            swap = psutil.swap_memory()
            swap_percent = float(swap.percent)
        except Exception:
            swap_percent = 0.0

        return RamMetrics(
            total_gb=round(float(vm.total) / (1024**3), 2),
            available_gb=round(float(vm.available) / (1024**3), 2),
            used_gb=round(float(vm.used) / (1024**3), 2),
            percent=float(vm.percent),
            swap_percent=swap_percent
        )
