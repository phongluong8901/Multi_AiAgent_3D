from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, JSON, String, Text
from app.models.base import Base


class FirmwareInteractionLog(Base):
    """
    Bảng lưu lịch sử giao tiếp Thực ↔ Ảo trong Room:
    - Câu nói từ người dùng qua Mic của mạch (user_prompt)
    - Tiến trình @agent_manager phân công cho các Agent con (delegation_steps)
    - Câu trả lời phát ra loa I2S của mạch qua luồng LLM Stream (spoken_response)
    - Chuỗi hành động điều khiển động cơ/LED (hardware_actions)
    """

    __tablename__ = "firmware_interaction_logs"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    device_id = Column(String(100), nullable=False, index=True)
    device_name = Column(String(200), nullable=True)
    board_type = Column(String(50), nullable=False, default="esp32_s3")
    room_id = Column(String(100), nullable=False, default="default_room", index=True)

    lead_agent_id = Column(String(100), nullable=False, default="agent_manager", index=True)
    sub_agents_used = Column(JSON, nullable=False, default=list)
    connection_type = Column(String(30), nullable=False, default="wifi")
    transport_protocol = Column(String(30), nullable=False, default="sse")

    user_prompt = Column(Text, nullable=False)
    agent_thought = Column(Text, nullable=True)
    delegation_steps = Column(JSON, nullable=False, default=list)
    spoken_response = Column(Text, nullable=False)
    hardware_actions = Column(JSON, nullable=False, default=list)

    obstacle_distance_cm = Column(Float, default=150.0)
    synced_to_room = Column(Boolean, default=True)
    latency_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

