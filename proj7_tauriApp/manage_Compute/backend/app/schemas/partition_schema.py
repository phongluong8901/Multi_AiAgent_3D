"""
Module định nghĩa các Pydantic Schema cho Phân vùng Bộ nhớ và Lưu trữ (Partition Schema).
Quản lý trạng thái các vùng nhớ RAM (Active, Cache, Standby), ổ đĩa và bộ nhớ đệm có thể dọn dẹp.
"""

from pydantic import BaseModel, Field
from typing import Optional, List

class MemoryPartitionItem(BaseModel):
    """
    Thông tin phân vùng chi tiết của một khối bộ nhớ hoặc ổ lưu trữ:
    dung lượng tổng, đã dùng, còn trống, khả năng giải phóng (purgeable) và vị trí vật lý.
    """
    id: str
    name: str
    category: str  # RAM_ACTIVE, RAM_CACHE, RAM_KERNEL, DISK_SSD, DISK_HDD, CACHE_TEMP
    storage_type: str  # RAM, SWAP, SSD, HDD, VIRTUAL
    priority: str  # CRITICAL, HIGH, NORMAL, LOW
    total_mb: float
    used_mb: float
    free_mb: float
    usage_percent: float
    is_purgeable: bool = False
    purge_action_id: Optional[str] = None
    description: str = ""
    location: Optional[str] = None

class SystemPartitionsOverview(BaseModel):
    """
    Báo cáo tổng quan phân vùng bộ nhớ và ổ đĩa của toàn hệ thống:
    tổng RAM, RAM khả dụng, bộ nhớ đệm standby có thể thu hồi và dung lượng ổ đĩa.
    """
    ram_total_mb: float
    ram_used_mb: float
    ram_free_mb: float
    standby_reclaimable_mb: float
    disks_total_gb: float
    disks_free_gb: float
    temp_cache_purgeable_mb: float
    partitions: List[MemoryPartitionItem] = []

class PartitionPurgeRequest(BaseModel):
    """
    Payload yêu cầu dọn dẹp hoặc thu hồi một phân vùng bộ nhớ hoặc cache tạm thời.
    """
    partition_id: str
    mode: str = "safe"

class PartitionPurgeResult(BaseModel):
    """
    Kết quả trả về sau khi thực hiện dọn dẹp phân vùng (dung lượng MB đã giải phóng và trạng thái).
    """
    partition_id: str
    status: str
    freed_mb: float
    message: str
