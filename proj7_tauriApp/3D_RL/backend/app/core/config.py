from pydantic_settings import BaseSettings
from pathlib import Path

# Duong dan goc cua thu muc backend (D:\...\backend)
BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """
    Quan ly cau hinh tap trung cua toan bo ung dung Backend.
    Su dung Pydantic BaseSettings de ho tro doc tu file .env hoac bien moi truong he thong.

    Cac truong thiet lap:
    - PROJECT_NAME: Ten hien thi cua du an tren Swagger docs va logs.
    - API_PREFIX: Tien to duong dan mac dinh cho toan bo cac route REST API.
    - MODELS_DIR: Thu muc luu tru cac mo hinh checkpoint da huan luyen (.pt, .zip).
    - DEVICE: Thiet bi tinh toan PyTorch ('cpu' hoac 'cuda').
    - DEFAULT_TIMESTEPS: So buoc timesteps mac dinh khi huan luyen PPO offline.
    """

    PROJECT_NAME: str = "RL Obstacle Avoidance Backend"
    API_PREFIX: str = "/api"
    MODELS_DIR: Path = BASE_DIR / "models"
    DEVICE: str = "cpu"          # Chuyen thanh 'cuda' neu may co GPU NVIDIA ho tro
    DEFAULT_TIMESTEPS: int = 80_000

    class Config:
        env_file = ".env"
        extra = "ignore"


# Khoi tao the hien singleton settings dung xuyen suot backend
settings = Settings()

# Tu dong tao thu muc models neu chua ton tai
try:
    settings.MODELS_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    pass
