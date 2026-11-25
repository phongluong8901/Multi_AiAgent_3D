import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PORT: int = int(os.getenv("PORT", "5009"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    AGENT_SERVICE_URL: str = os.getenv("AGENT_SERVICE_URL", "http://localhost:8000")
    SAVED_POLICIES_DIR: str = os.getenv("SAVED_POLICIES_DIR", "./saved_policies")

    class Config:
        env_file = ".env"

settings = Settings()
