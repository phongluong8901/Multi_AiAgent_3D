from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Virtual Office Agent Service"
    DEBUG: bool = True
    PORT: int = 8000
    DATABASE_URL: str
    GOOGLE_API_KEY_MODEL: str = ""
    GOOGLE_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash-lite"

    # Tự động trỏ đến file .env ở thư mục gốc
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
