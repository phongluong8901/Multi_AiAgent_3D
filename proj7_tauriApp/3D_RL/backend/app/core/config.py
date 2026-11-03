from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "RL Obstacle Avoidance Backend"
    API_PREFIX: str = "/api"
    MODELS_DIR: Path = BASE_DIR / "models"
    DEVICE: str = "cpu"          # "cpu" hoặc "cuda"
    DEFAULT_TIMESTEPS: int = 80_000

    class Config:
        env_file = ".env"

settings = Settings()
try:
    settings.MODELS_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    pass
