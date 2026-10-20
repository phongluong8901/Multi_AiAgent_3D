from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Virtual Office Agent Service"
    DEBUG: bool = True
    PORT: int = 8000
    DATABASE_URL: str

    # Tự động trỏ đến file .env ở thư mục gốc
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()