from typing import Any, Dict
from app.schemas.codegen import GenerateFirmwareRequest
from app.patterns.generators import (
    SUPPORTED_BOARDS,
    SUPPORTED_CONNECTIONS,
    SUPPORTED_TRANSPORTS,
    generate_firmware_code,
)


class FirmwareCodeGeneratorFactory:
    """
    Factory Pattern quản lý danh mục phần cứng nhúng (ESP32, ESP32-S3, ESP32-CAM, Raspberry Pi, Jetson)
    và sinh mã nguồn C++ Arduino / Python tương ứng với cấu hình Kết nối (WiFi/BLE/IP) & Truyền tải (SSE/WS/MQTT/ESP-NOW/HTTP).
    """

    @staticmethod
    def get_catalog() -> Dict[str, Any]:
        return {
            "boards": SUPPORTED_BOARDS,
            "connections": SUPPORTED_CONNECTIONS,
            "transports": SUPPORTED_TRANSPORTS,
        }

    @staticmethod
    def create_firmware(req: GenerateFirmwareRequest) -> Dict[str, Any]:
        return generate_firmware_code(req)


codegen_factory = FirmwareCodeGeneratorFactory()
