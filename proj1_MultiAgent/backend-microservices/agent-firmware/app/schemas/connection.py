from typing import Literal
from pydantic import BaseModel, Field

ConnectionType = Literal["wifi", "ble", "ip"]
TransportProtocol = Literal["mqtt", "http", "websocket", "esp_now", "sse"]
BoardType = Literal["esp32", "esp32_s3", "esp32_cam", "raspberry_pi", "jetson"]


class WifiConfig(BaseModel):
    ssid: str = Field(default="MultiAgent_WiFi_2.4G")
    password: str = Field(default="12345678")
    band: str = Field(default="2.4GHz")
    channel: int = Field(default=1, ge=1, le=14)
    auto_reconnect: bool = Field(default=True)
    power_save_mode: Literal["none", "min_modem", "max_modem"] = Field(default="none")


class BleConfig(BaseModel):
    device_name: str = Field(default="ESP32S3-Agent-Node")
    mac_address: str = Field(default="24:6F:28:AA:BB:CC")
    service_uuid: str = Field(default="4fafc201-1fb5-459e-8fcc-c5c9c331914b")
    tx_char_uuid: str = Field(default="beb5483e-36e1-4688-b7f5-ea07361b26a8")
    rx_char_uuid: str = Field(default="828917c1-4422-4a2b-9f1a-1234567890ab")
    mtu_size: int = Field(default=512, ge=23, le=517)


class IpNetworkConfig(BaseModel):
    mode: Literal["dhcp", "static"] = Field(default="dhcp")
    local_ip: str = Field(default="192.168.1.188")
    gateway_ip: str = Field(default="192.168.1.1")
    subnet_mask: str = Field(default="255.255.255.0")
    dns_primary: str = Field(default="8.8.8.8")
    dns_secondary: str = Field(default="1.1.1.1")
    server_host: str = Field(default="192.168.1.100")
    server_port: int = Field(default=4000)


class MqttTransportConfig(BaseModel):
    broker_host: str = Field(default="broker.emqx.io")
    broker_port: int = Field(default=1883)
    username: str = Field(default="")
    password: str = Field(default="")
    qos: int = Field(default=0, ge=0, le=2)
    topic_prompt: str = Field(default="multiagent/room/{room_id}/device/{device_id}/prompt")
    topic_stream: str = Field(default="multiagent/room/{room_id}/device/{device_id}/stream")
    topic_action: str = Field(default="multiagent/room/{room_id}/device/{device_id}/action")
    topic_telemetry: str = Field(default="multiagent/room/{room_id}/device/{device_id}/telemetry")


class EspNowTransportConfig(BaseModel):
    gateway_mac: str = Field(default="30:AE:A4:07:0D:64")
    peer_mac: str = Field(default="24:0A:C4:12:34:56")
    wifi_channel: int = Field(default=1, ge=1, le=14)
    encrypted: bool = Field(default=False)
    pmk_key: str = Field(default="MultiAgentPMKKey")
    max_frame_bytes: int = Field(default=240, ge=64, le=250)


class ConnectionProfile(BaseModel):
    connection_type: ConnectionType = Field(default="wifi")
    transport_protocol: TransportProtocol = Field(default="sse")
    wifi: WifiConfig = Field(default_factory=WifiConfig)
    ble: BleConfig = Field(default_factory=BleConfig)
    ip: IpNetworkConfig = Field(default_factory=IpNetworkConfig)
    mqtt: MqttTransportConfig = Field(default_factory=MqttTransportConfig)
    esp_now: EspNowTransportConfig = Field(default_factory=EspNowTransportConfig)

