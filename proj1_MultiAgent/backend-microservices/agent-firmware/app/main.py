from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.seeders import run_all_seeders
# Đăng ký toàn bộ SQLAlchemy ORM models với Base.metadata
from app.models import device, flash_history, interaction_log, telemetry_log  # noqa: F401
from app.patterns.codegen_factory import codegen_factory


def init_db() -> None:
    try:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            run_all_seeders(db)
        finally:
            db.close()
        print("[agent-firmware] ✅ Database tables and seeders initialized on Neon PostgreSQL.")
    except Exception as exc:
        print(f"[agent-firmware] ⚠️ Database initialization warning: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "Microservice quản lý nạp Agent vào phần cứng nhúng (ESP32, ESP32-S3, ESP32-CAM, Raspberry Pi, Jetson), "
        "hỗ trợ cấu hình kết nối (WiFi, BLE, Static IP), giao thức truyền tải (SSE, WebSocket, MQTT, HTTP, ESP-NOW), "
        "và lưu trữ lịch sử hội thoại / nạp code / telemetry trên Neon PostgreSQL."
    ),
    version="2.5.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health_check():
    catalog = codegen_factory.get_catalog()
    return {
        "status": "ok",
        "service": "agent-firmware",
        "version": "2.5.0",
        "database": "Neon PostgreSQL",
        "supported_boards": [b["id"] for b in catalog["boards"]],
        "supported_connections": [c["id"] for c in catalog["connections"]],
        "supported_transports": [t["id"] for t in catalog["transports"]],
    }
