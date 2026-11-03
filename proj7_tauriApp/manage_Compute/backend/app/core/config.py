from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Compute Studio Backend Engine"
    VERSION: str = "1.0.0"
    HOST: str = "127.0.0.1"
    PORT: int = 14200
    TELEMETRY_INTERVAL_SEC: float = 1.0
    CORS_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = ".env"

settings = Settings()