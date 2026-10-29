from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.connection import ConnectionProfile, ConnectionType, TransportProtocol


class GenerateFirmwareRequest(BaseModel):
    board_type: str = Field(default="esp32_s3")
    agent_id: str = Field(default="agent_manager")
    agent_name: str = Field(default="ESP32S3_Room_Agent")
    room_id: str = Field(default="default_room")
    connection_type: ConnectionType = Field(default="wifi")
    transport_protocol: TransportProtocol = Field(default="sse")
    wifi_ssid: str = Field(default="MultiAgent_WiFi_2.4G")
    wifi_password: str = Field(default="12345678")
    server_url: str = Field(default="http://192.168.1.100:4000")
    enable_voice_tts: bool = Field(default=True)
    active_sub_agents: List[str] = Field(
        default_factory=lambda: ["agent_search", "agent_calculate", "agent_analysis", "agent_data"]
    )
    connection_profile: Optional[ConnectionProfile] = None

