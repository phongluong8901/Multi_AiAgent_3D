from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, JSON, String, Text
from app.models.base import Base


class FirmwareFlashHistory(Base):
    """Bảng lưu lịch sử nạp Agent (Flash) và xuất mã nguồn C++ / Python cho các mạch nhúng."""

    __tablename__ = "firmware_flash_histories"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    device_id = Column(String(100), nullable=False, index=True)
    board_type = Column(String(50), nullable=False, default="esp32_s3")
    room_id = Column(String(100), nullable=False, default="default_room", index=True)
    agent_id = Column(String(100), nullable=False, default="agent_manager")
    sub_agents = Column(JSON, nullable=False, default=list)

    connection_type = Column(String(30), nullable=False, default="wifi")
    transport_protocol = Column(String(30), nullable=False, default="sse")
    firmware_version = Column(String(50), default="v2.4.0-stream")
    action_type = Column(String(50), default="flash_agent")  # flash_agent | generate_code
    filename = Column(String(150), nullable=True)
    code_snapshot = Column(Text, nullable=True)
    status = Column(String(30), default="success")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

