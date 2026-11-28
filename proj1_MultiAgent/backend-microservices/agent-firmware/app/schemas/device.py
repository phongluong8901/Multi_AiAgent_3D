from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field
from app.schemas.connection import BoardType, ConnectionProfile, ConnectionType, TransportProtocol


class FirmwareDeviceRegistration(BaseModel):
    device_id: str = Field(..., description="Mã định danh duy nhất của mạch (VD: esp32_s3_rover_01)")
    device_name: str = Field(default="ESP32-S3 Voice & Rover Agent")
    board_type: BoardType = Field(default="esp32_s3")
    room_id: str = Field(default="default_room")
    agent_id: str = Field(default="agent_manager")
    sub_agents: List[str] = Field(
        default_factory=lambda: ["agent_search", "agent_calculate", "agent_analysis"]
    )
    connection_type: ConnectionType = Field(default="wifi")
    transport_protocol: TransportProtocol = Field(default="sse")
    connection_profile: ConnectionProfile = Field(default_factory=ConnectionProfile)
    enable_voice_tts: bool = Field(default=True)
    firmware_version: str = Field(default="v2.4.0-stream")
    logic_script: Optional[str] = Field(default=None)
    status: Literal["online", "offline", "flashing", "streaming"] = Field(default="online")
    metadata: Dict[str, Any] = Field(default_factory=dict)

