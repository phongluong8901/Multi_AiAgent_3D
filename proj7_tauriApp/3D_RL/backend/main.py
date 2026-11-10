import sys
from pathlib import Path

# ==============================================================================
# KHOI TAO HE THONG VA MOI TRUONG BACKEND
# ==============================================================================
# Dam bao thu muc goc cua backend luon nam trong sys.path de import cac module noi bo:
# app.api, app.core, app.brain, app.envs, app.internal, app.services, app.trainers.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.core.config import settings

# ==============================================================================
# KHOI TAO UNG DUNG FASTAPI
# ==============================================================================
# Backend dong vai tro la Cognitive Server & Simulation Engine:
# - Cung cap cac REST API endpoint dieu khien mo phong, huan luyen va luu tru.
# - Cung cap WebSocket Server kenh truyen 2 chieu telemetries thoi gian thuc ve Frontend/Tauri.
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Backend Mo Phong AI Tre Em (AI Child Simulation), hoc tang cuong RL & nhan thuc khong gian.",
)

# ==============================================================================
# CAU HINH CORS (CROSS-ORIGIN RESOURCE SHARING)
# ==============================================================================
# Cho phep ung dung Frontend (Vite tren port 5173/5174 hoac Tauri WebView)
# gui request REST va thiet lap ket noi WebSocket toi backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dang ky router API voi tien to duoc cau hinh (mac dinh: /api)
app.include_router(router, prefix=settings.API_PREFIX)


@app.get("/")
def root():
    """
    Endpoint kiem tra trang thai hoat dong (Health Check) cua Backend server.

    Returns:
        dict: Thong tin thong diep trang thai va duong dan toi Swagger API documentation (/docs).
    """
    return {
        "message": "RL Obstacle Avoidance Backend is running",
        "docs": "/docs",
    }
