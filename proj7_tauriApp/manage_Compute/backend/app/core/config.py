"""
Module cấu hình hệ thống (Settings) cho Backend Engine.
Sử dụng Pydantic BaseSettings để nạp biến môi trường và thiết lập tham số máy chủ.
"""

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """
    Lớp định nghĩa các biến cấu hình toàn cục cho ứng dụng.
    Bao gồm tên ứng dụng, phiên bản, địa chỉ máy chủ, chu kỳ đo đạc telemetry và cấu hình CORS.
    """
    APP_NAME: str = "Compute Studio Backend Engine"
    VERSION: str = "1.0.0"
    HOST: str = "127.0.0.1"
    PORT: int = 14200
    TELEMETRY_INTERVAL_SEC: float = 1.0
    CORS_ORIGINS: list[str] = ["*"]

    class Config:
        """Cấu hình nạp tệp biến môi trường .env."""
        env_file = ".env"

# Khởi tạo đối tượng settings toàn cục dùng cho toàn bộ backend
settings = Settings()
