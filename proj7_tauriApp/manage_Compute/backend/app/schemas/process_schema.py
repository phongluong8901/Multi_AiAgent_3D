"""
Module định nghĩa các Pydantic Schema cho Tiến trình và Mạng (Process & Network).
Quản lý thông tin định danh tiến trình, tài nguyên tiêu thụ, socket mạng, và các hành động điều khiển.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum

class ProcessActionType(str, Enum):
    """
    Enum định nghĩa các loại hành động can thiệp vào tiến trình hệ thống:
    dừng, tạm dừng, thu hồi bộ nhớ, gán độ ưu tiên, giới hạn lõi CPU, giải phóng cổng mạng, áp đặt quota.
    """
    KILL = "kill"
    TERMINATE = "terminate"
    SUSPEND = "suspend"
    RESUME = "resume"
    TRIM_MEMORY = "trim_memory"
    SET_PRIORITY = "set_priority"
    SET_AFFINITY = "set_affinity"
    RELEASE_PORT = "release_port"
    APPLY_QUOTA = "apply_quota"

class ProcessInfo(BaseModel):
    """
    Mô hình dữ liệu chi tiết của một tiến trình hệ thống đang chạy.
    Bao gồm PID, tên, người sở hữu, mức sử dụng CPU/RAM, số luồng và danh sách cổng đang lắng nghe.
    """
    pid: int
    name: str
    username: Optional[str] = None
    status: str
    cpu_percent: float
    memory_percent: float
    memory_mb: float
    num_threads: int
    cmdline: List[str] = []
    open_ports: List[int] = []

class SpawnServiceRequest(BaseModel):
    """
    Payload yêu cầu khởi chạy một tiến trình hoặc dịch vụ nền mới.
    """
    name: str
    command: str
    cwd: Optional[str] = None

class SetPriorityRequest(BaseModel):
    """
    Payload thiết lập mức độ ưu tiên CPU cho tiến trình (idle, below_normal, normal, high, realtime).
    """
    priority: str = Field(default="idle", description="idle, below_normal, normal, high, realtime")

class SetAffinityRequest(BaseModel):
    """
    Payload giới hạn tiến trình chỉ được chạy trên các lõi CPU vật lý chỉ định (CPU Affinity).
    """
    cores: List[int] = Field(default=[0, 1])

class ReleasePortRequest(BaseModel):
    """
    Payload yêu cầu giải phóng cổng mạng đang bị chiếm dụng bởi tiến trình.
    """
    port: int

class ApplyQuotaRequest(BaseModel):
    """
    Payload cấu hình hạn mức tài nguyên (Resource Quota) cho tiến trình:
    lõi CPU, dung lượng RAM tối đa, ngưỡng CPU và chính sách xử lý khi vượt ngưỡng.
    """
    cores: Optional[List[int]] = None
    max_ram_mb: Optional[float] = None
    max_cpu_percent: Optional[float] = None
    gpu_index: Optional[int] = None
    policy: str = "TRIM_AND_THROTTLE"

class SocketConnectionItem(BaseModel):
    """
    Mô hình dữ liệu của một kết nối mạng socket (TCP/UDP).
    Bao gồm địa chỉ/cổng cục bộ, địa chỉ/cổng đích, domain phân giải và phân loại mục đích.
    """
    protocol: str = "TCP"
    local_ip: str
    local_port: int
    remote_ip: Optional[str] = None
    remote_port: Optional[int] = None
    remote_host: Optional[str] = None
    url: Optional[str] = None
    status: str = "UNKNOWN"
    category: str = "UNKNOWN"
    description: Optional[str] = None

class ProcessNetworkProfile(BaseModel):
    """
    Hồ sơ lưu lượng mạng của một tiến trình cụ thể:
    danh sách kết nối ra ngoài, cổng lắng nghe, danh sách tên miền đã truy cập.
    """
    pid: int
    name: str
    total_connections: int
    listening_ports: List[int] = []
    outbound_connections: List[SocketConnectionItem] = []
    domains_contacted: List[str] = []
    categories: List[str] = []

class SystemNetworkSummary(BaseModel):
    """
    Báo cáo tổng hợp tình trạng mạng toàn hệ thống:
    tổng kết nối đang hoạt động, danh sách tiến trình và tên miền chiếm nhiều kết nối nhất.
    """
    total_active_connections: int
    monitored_processes_count: int
    top_domains: List[dict] = []
    top_processes: List[dict] = []
