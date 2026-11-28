from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, JSON, String, Text
from app.models.base import Base


class FirmwareDevice(Base):
    """Bảng lưu trữ danh sách các mạch nhúng (ESP32, ESP32-S3, RPi, Jetson...) và cấu hình kết nối Room."""

    __tablename__ = "firmware_devices"

    device_id = Column(String(100), primary_key=True, index=True)
    device_name = Column(String(200), nullable=False, default="ESP32-S3 AI Voice Rover")
    board_type = Column(String(50), nullable=False, default="esp32_s3", index=True)
    room_id = Column(String(100), nullable=False, default="default_room", index=True)
    agent_id = Column(String(100), nullable=False, default="agent_manager", index=True)
    sub_agents = Column(JSON, nullable=False, default=list)

    # Cấu hình kết nối vật lý (wifi | ble | ip) & giao thức truyền tải (sse | websocket | mqtt | esp_now | http)
    connection_type = Column(String(30), nullable=False, default="wifi")
    transport_protocol = Column(String(30), nullable=False, default="sse")
    connection_profile = Column(JSON, nullable=False, default=dict)

    enable_voice_tts = Column(Boolean, default=True)
    firmware_version = Column(String(50), default="v2.4.0-stream")
    status = Column(String(30), default="online")
    logic_script = Column(Text, nullable=True)
    extra_metadata = Column(JSON, nullable=False, default=dict)

    last_seen_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

