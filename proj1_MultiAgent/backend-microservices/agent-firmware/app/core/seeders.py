from sqlalchemy.orm import Session
from app.models.device import FirmwareDevice
from app.repositories.device_repository import device_repository
from app.repositories.history_repository import history_repository
from app.schemas.connection import ConnectionProfile
from app.schemas.device import FirmwareDeviceRegistration


def run_all_seeders(db: Session) -> None:
    """Khởi tạo các thiết bị mẫu (ESP32-S3 Voice AI, ESP32 ESP-NOW Mesh, ESP32-CAM MQTT) vào Neon PostgreSQL."""
    count = db.query(FirmwareDevice).count()
    if count > 0:
        return

    default_devices = [
        FirmwareDeviceRegistration(
            device_id="esp32_s3_rover_01",
            device_name="ESP32-S3 AI Voice & Rover #01",
            board_type="esp32_s3",
            room_id="default_room",
            agent_id="agent_manager",
            sub_agents=["agent_search", "agent_calculate", "agent_analysis"],
            connection_type="wifi",
            transport_protocol="sse",
            connection_profile=ConnectionProfile(connection_type="wifi", transport_protocol="sse"),
            enable_voice_tts=True,
            firmware_version="v2.4.0-stream",
            status="online",
        ),
        FirmwareDeviceRegistration(
            device_id="esp32_espnow_node_02",
            device_name="ESP32 Swarm Node #02 (ESP-NOW Mesh)",
            board_type="esp32",
            room_id="default_room",
            agent_id="agent_manager",
            sub_agents=["agent_search", "agent_calculate"],
            connection_type="wifi",
            transport_protocol="esp_now",
            connection_profile=ConnectionProfile(connection_type="wifi", transport_protocol="esp_now"),
            enable_voice_tts=True,
            firmware_version="v2.4.0-mesh",
            status="online",
        ),
        FirmwareDeviceRegistration(
            device_id="esp32_ble_mqtt_03",
            device_name="ESP32-CAM Vision & MQTT Bridge #03",
            board_type="esp32_cam",
            room_id="default_room",
            agent_id="agent_manager",
            sub_agents=["agent_search", "agent_analysis", "agent_data"],
            connection_type="ble",
            transport_protocol="mqtt",
            connection_profile=ConnectionProfile(connection_type="ble", transport_protocol="mqtt"),
            enable_voice_tts=False,
            firmware_version="v2.4.0-vision",
            status="online",
        ),
    ]

    for dev in default_devices:
        device_repository.upsert_device(db, dev)
        history_repository.create_flash_history(
            db,
            device_id=dev.device_id,
            board_type=dev.board_type,
            room_id=dev.room_id,
            agent_id=dev.agent_id,
            sub_agents=dev.sub_agents,
            connection_type=dev.connection_type,
            transport_protocol=dev.transport_protocol,
            firmware_version=dev.firmware_version,
            action_type="seed_device",
            filename=f"{dev.board_type}_{dev.agent_id}_{dev.transport_protocol}.ino",
            status="success",
            notes=f"Khởi tạo mặc định thiết bị {dev.device_name} trên Neon PostgreSQL",
        )

    history_repository.create_interaction_log(
        db,
        device_id="esp32_s3_rover_01",
        device_name="ESP32-S3 AI Voice & Rover #01",
        board_type="esp32_s3",
        room_id="default_room",
        lead_agent_id="agent_manager",
        sub_agents_used=["agent_search", "agent_analysis"],
        connection_type="wifi",
        transport_protocol="sse",
        user_prompt="Thời tiết hôm nay thế nào?",
        agent_thought="Nhận câu hỏi từ Mic INMP441 -> @agent_manager phân công @agent_search tra cứu khí tượng và @agent_analysis tổng hợp phát ra loa I2S.",
        delegation_steps=[
            {"type": "agent_step", "agent_id": "agent_manager", "content": "Phân công @agent_search và @agent_analysis kiểm tra thời tiết"},
            {"type": "tool_start", "agent_id": "agent_search", "tool": "web_search_tool"},
        ],
        spoken_response="Xin chào! Quản lý @agent_manager báo cáo từ @agent_search: Thời tiết hôm nay 28°C, trời nắng nhẹ, độ ẩm 72%, rất thuận lợi cho hoạt động!",
        hardware_actions=[],
        obstacle_distance_cm=150.0,
        synced_to_room=True,
        latency_ms=340,
    )
    print("[agent-firmware Seeder] Seeded default devices, flash histories, and interaction logs.")

