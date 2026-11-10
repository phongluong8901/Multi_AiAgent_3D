"""
Module dinh nghia cac Pydantic Schema cho he thong bo nho Agent (`memory_schema.py`).
Bao gom bo nho ngan han (Short-term / sliding window) va bo nho dai han (Long-term persistent facts).
"""

from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime


class ShortMemoryMessage(BaseModel):
    """
    Schema tin nhan hoi thoai ngan han theo chuan chat completion:
    - role: Vai tro nguoi noi (user, assistant, system, tool)
    - content: Noi dung trao doi
    """
    role: Literal["user", "assistant", "system", "tool"]
    content: str


class MemoryAddRequest(BaseModel):
    """
    Schema yeu cau ghi nho fact / kien thuc vao bo nho dai han cua Agent:
    - room_id: ID phong chat lien ket (tuy chon)
    - memory_type: Phan loai tri thuc (fact, summary, preference, rule)
    - content: Noi dung thong tin can ghi nho ben vung
    """
    room_id: Optional[str] = None
    memory_type: str = "fact"
    content: str


class MemoryResponse(BaseModel):
    """
    Schema phan hoi ban ghi bo nho dai han luu trong PostgreSQL.
    """
    id: int
    agent_id: str
    room_id: Optional[str]
    memory_type: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ShortMemoryResponse(BaseModel):
    """
    Schema phan hoi toan bo sliding window hoi thoai gan nhat tu Redis cache.
    """
    agent_id: str
    room_id: Optional[str]
    messages: List[ShortMemoryMessage]
    total_turns: int
