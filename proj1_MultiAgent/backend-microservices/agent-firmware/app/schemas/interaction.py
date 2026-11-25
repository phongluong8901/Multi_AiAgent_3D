from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.connection import ConnectionType, TransportProtocol


class RobotCommandRequest(BaseModel):
    prompt: str
    current_x: float = 0.0
    current_z: float = 0.0
    current_rotation: float = 0.0
    obstacle_distance: float = 150.0
    room_id: Optional[str] = None
    agent_id: str = "agent_manager"
    device_id: str = "esp32_s3_rover_01"
    board_type: str = "esp32_s3"
    connection_type: ConnectionType = "wifi"
    transport_protocol: TransportProtocol = "sse"


class RoomFirmwareStreamRequest(BaseModel):
    prompt: str = Field(..., description="Câu nói/lệnh của người dùng từ Robot thực tế hoặc Simulator")
    room_id: str = Field(default="default_room")
    device_id: str = Field(default="esp32_s3_rover_01")
    device_name: str = Field(default="ESP32-S3 Embodied Robot")
    board_type: str = Field(default="esp32_s3")
    agent_id: str = Field(default="agent_manager")
    sub_agents: List[str] = Field(
        default_factory=lambda: ["agent_search", "agent_calculate", "agent_analysis"]
    )
    connection_type: ConnectionType = Field(default="wifi")
    transport_protocol: TransportProtocol = Field(default="sse")
    sender_id: str = Field(default="firmware_user")
    sender_name: str = Field(default="User (via ESP32-S3 Mic)")
    sync_to_room_chat: bool = Field(default=True)
    current_x: float = 0.0
    current_z: float = 0.0
    current_rotation: float = 0.0
    obstacle_distance: float = 150.0


class TelemetryLogCreate(BaseModel):
    device_id: str = Field(default="esp32_s3_rover_01")
    board_type: str = Field(default="esp32_s3")
    room_id: str = Field(default="default_room")
    obstacle_distance_cm: float = Field(default=150.0)
    battery_voltage: float = Field(default=7.4)
    wifi_rssi_dbm: int = Field(default=-52)
    pos_x: float = Field(default=0.0)
    pos_z: float = Field(default=0.0)
    rotation_deg: float = Field(default=0.0)
    led_color: str = Field(default="#10b981")

