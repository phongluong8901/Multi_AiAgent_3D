from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime


class ShortMemoryMessage(BaseModel):
    role: Literal["user", "assistant", "system", "tool"]
    content: str


class MemoryAddRequest(BaseModel):
    room_id: Optional[str] = None
    memory_type: Literal["fact", "summary", "preference"] = "fact"
    content: str


class MemoryResponse(BaseModel):
    id: int
    agent_id: str
    room_id: Optional[str]
    memory_type: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ShortMemoryResponse(BaseModel):
    agent_id: str
    room_id: Optional[str]
    messages: List[ShortMemoryMessage]
    total_turns: int
