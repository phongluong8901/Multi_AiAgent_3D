from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Agent Firmware & Embodied Room Bridge Service"
    DEBUG: bool = True
    PORT: int = 5014

    # Neon PostgreSQL Database URL (tương tự agent-service)
    DATABASE_URL: str = (
        "postgresql://neondb_owner:npg_nGjr85EBbXPw@ep-fragrant-fire-a1icbw9e-pooler.ap-southeast-1.aws.neon.tech/firmware_db?sslmode=require&channel_binding=require"
    )
    FALLBACK_DATABASE_URL: str = (
        "postgresql://neondb_owner:npg_nGjr85EBbXPw@ep-fragrant-fire-a1icbw9e-pooler.ap-southeast-1.aws.neon.tech/agents_db?sslmode=require&channel_binding=require"
    )

    AGENT_SERVICE_URL: str = "http://localhost:8000"
    CHAT_SERVICE_URL: str = "http://localhost:5003"
    ROOM_SERVICE_URL: str = "http://localhost:5002"
    GATEWAY_URL: str = "http://localhost:4000"

    MQTT_BROKER_HOST: str = "broker.emqx.io"
    MQTT_BROKER_PORT: int = 1883

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

