from pydantic import BaseModel
from typing import Optional, List
from enum import Enum

class ProcessActionType(str, Enum):
    KILL = "kill"
    TERMINATE = "terminate"
    SUSPEND = "suspend"
    RESUME = "resume"

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