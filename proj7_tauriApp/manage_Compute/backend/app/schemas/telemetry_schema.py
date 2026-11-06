"""
Module định nghĩa các Pydantic Schema cho Dữ liệu Đo đạc Hệ thống (Telemetry Schema).
Bao gồm các chỉ số CPU, RAM, GPU Nvidia, I/O ổ đĩa, lưu lượng mạng và ảnh chụp tức thời (Snapshot).
"""

from pydantic import BaseModel
from typing import List, Optional
from app.schemas.process_schema import ProcessInfo

class CpuMetrics(BaseModel):
    """
    Chỉ số hiệu năng bộ vi xử lý (CPU):
    tỷ lệ phần trăm tổng, phần trăm trên từng lõi, xung nhịp hiện tại, số lõi logic và vật lý.
    """
    percent: float
    per_core: List[float]
    freq_current_mhz: float
    freq_max_mhz: float
    logical_cores: int
    physical_cores: Optional[int]

class RamMetrics(BaseModel):
    """
    Chỉ số bộ nhớ truy xuất ngẫu nhiên (RAM):
    tổng dung lượng, khả dụng, đã dùng, phần trăm sử dụng và tỷ lệ hoán đổi Swap.
    """
    total_gb: float
    available_gb: float
    used_gb: float
    percent: float
    swap_percent: float

class GpuMetrics(BaseModel):
    """
    Chỉ số bộ xử lý đồ họa (GPU):
    mức tải (load percent), VRAM đã dùng và tổng VRAM, nhiệt độ (độ C) và công suất tiêu thụ (Watts).
    """
    id: int
    name: str
    load_percent: float
    memory_used_mb: float
    memory_total_mb: float
    memory_percent: float
    temp_c: float
    power_watts: Optional[float] = None

class DiskNetMetrics(BaseModel):
    """
    Chỉ số I/O ổ đĩa và lưu lượng truyền nhận mạng (Network Traffic).
    """
    disk_usage_percent: float
    disk_free_gb: float
    net_bytes_sent_mb: float
    net_bytes_recv_mb: float

class SystemSnapshot(BaseModel):
    """
    Ảnh chụp tức thời toàn diện tình trạng phần cứng và tiến trình hệ thống tại một mốc thời gian.
    Được gửi định kỳ qua kênh WebSocket tới Frontend Dashboard.
    """
    timestamp: float
    cpu: CpuMetrics
    ram: RamMetrics
    gpus: List[GpuMetrics]
    io: DiskNetMetrics
    processes: List[ProcessInfo] = []
