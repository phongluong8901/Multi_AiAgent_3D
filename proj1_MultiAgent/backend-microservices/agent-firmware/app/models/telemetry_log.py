from datetime import datetime
from sqlalchemy import Column, DateTime, Float, Integer, String
from app.models.base import Base


class FirmwareTelemetryLog(Base):
    """Bảng lưu lịch sử thông số cảm biến thời gian thực (Siêu âm HC-SR04, Pin LiPo, RSSI, Tọa độ 3D)."""

    __tablename__ = "firmware_telemetry_logs"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    device_id = Column(String(100), nullable=False, index=True)
    board_type = Column(String(50), nullable=False, default="esp32_s3")
    room_id = Column(String(100), nullable=False, default="default_room", index=True)

    obstacle_distance_cm = Column(Float, default=150.0)
    battery_voltage = Column(Float, default=7.4)
    wifi_rssi_dbm = Column(Integer, default=-52)
    pos_x = Column(Float, default=0.0)
    pos_z = Column(Float, default=0.0)
    rotation_deg = Column(Float, default=0.0)
    led_color = Column(String(20), default="#10b981")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

