from pydantic import BaseModel
from typing import List, Optional

class CpuMetrics(BaseModel):
    percent: float
    per_core: List[float]
    freq_current_mhz: float
    freq_max_mhz: float
    logical_cores: int
    physical_cores: Optional[int]

class RamMetrics(BaseModel):
    total_gb: float
    available_gb: float
    used_gb: float
    percent: float
    swap_percent: float

class GpuMetrics(BaseModel):
    id: int
    name: str
    load_percent: float
    memory_used_mb: float
    memory_total_mb: float
    memory_percent: float
    temp_c: float
    power_watts: Optional[float] = None

class DiskNetMetrics(BaseModel):
    disk_usage_percent: float
    disk_free_gb: float
    net_bytes_sent_mb: float
    net_bytes_recv_mb: float

class SystemSnapshot(BaseModel):
    timestamp: float
    cpu: CpuMetrics
    ram: RamMetrics
    gpus: List[GpuMetrics]
    io: DiskNetMetrics