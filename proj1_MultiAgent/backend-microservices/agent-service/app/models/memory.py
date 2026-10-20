from sqlalchemy import Column, String, Text, DateTime, Integer
from sqlalchemy.sql import func
from app.models.base import Base


class AgentMemoryModel(Base):
    """
    Long-term memory của Agent – lưu facts, tóm tắt hội thoại quan trọng.
    Được lưu trong PostgreSQL để bền vững qua các phiên.
    """
    __tablename__ = "agent_memories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(String, nullable=False, index=True)
    room_id = Column(String, nullable=True, index=True)   # Gắn với room cụ thể (tuỳ chọn)
    memory_type = Column(String, default="fact")          # "fact" | "summary" | "preference"
    content = Column(Text, nullable=False)               # Nội dung memory
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
