from fastapi import APIRouter
from app.patterns.codegen_factory import codegen_factory
from app.schemas.connection import ConnectionProfile

router = APIRouter(prefix="/firmware", tags=["Boards & Protocols"])


@router.get("/boards")
def get_supported_boards():
    """
    Lấy danh mục các bo mạch vi điều khiển (Hardware Boards) được hỗ trợ nạp Agent:
    - ESP32 (WiFi / BLE)
    - ESP32-S3 (AI & Vector Acceleration)
    - ESP32-CAM (Camera & Vision Stream)
    - Raspberry Pi (Linux Microcomputer)
    - Jetson Nano / Orin (Edge AI Accelerator)
    """
    return codegen_factory.get_catalog()


@router.get("/protocols")
def get_supported_protocols():
    """
    Lấy danh sách các phương thức kết nối vật lý (WiFi, BLE, Static IP)
    và các giao thức truyền tải thời gian thực (SSE, WebSocket, MQTT, HTTP, ESP-NOW) được hỗ trợ.
    """
    catalog = codegen_factory.get_catalog()
    return {
        "connections": catalog["connections"],
        "transports": catalog["transports"],
        "default_profile": ConnectionProfile().model_dump(),
    }
