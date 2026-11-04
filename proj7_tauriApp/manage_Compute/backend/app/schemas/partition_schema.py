from pydantic import BaseModel, Field
from typing import Optional, List

class MemoryPartitionItem(BaseModel):
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
    ram_total_mb: float
    ram_used_mb: float
    ram_free_mb: float
    standby_reclaimable_mb: float
    disks_total_gb: float
    disks_free_gb: float
    temp_cache_purgeable_mb: float
    partitions: List[MemoryPartitionItem] = []

class PartitionPurgeRequest(BaseModel):
    partition_id: str
    mode: str = "safe"

class PartitionPurgeResult(BaseModel):
    partition_id: str
    status: str
    freed_mb: float
    message: str

