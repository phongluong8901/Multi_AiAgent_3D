from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum

class ProcessActionType(str, Enum):
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
    name: str
    command: str
    cwd: Optional[str] = None

class SetPriorityRequest(BaseModel):
    priority: str = Field(default="idle", description="idle, below_normal, normal, high, realtime")

class SetAffinityRequest(BaseModel):
    cores: List[int] = Field(default=[0, 1])

class ReleasePortRequest(BaseModel):
    port: int

class ApplyQuotaRequest(BaseModel):
    cores: Optional[List[int]] = None
    max_ram_mb: Optional[float] = None
    max_cpu_percent: Optional[float] = None
    gpu_index: Optional[int] = None
    policy: str = "TRIM_AND_THROTTLE"

class SocketConnectionItem(BaseModel):
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
    pid: int
    name: str
    total_connections: int
    listening_ports: List[int] = []
    outbound_connections: List[SocketConnectionItem] = []
    domains_contacted: List[str] = []
    categories: List[str] = []

class SystemNetworkSummary(BaseModel):
    total_active_connections: int
    monitored_processes_count: int
    top_domains: List[dict] = []
    top_processes: List[dict] = []
