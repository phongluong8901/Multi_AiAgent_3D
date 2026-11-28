"""
Điểm khởi chạy máy chủ Backend Engine cho Compute Studio (FastAPI).
Đăng ký middleware CORS, hệ thống router API (REST + WebSocket), và endpoint kiểm tra sức khỏe.
"""

import multiprocessing
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.router import api_router

def create_app() -> FastAPI:
    """
    Khởi tạo và cấu hình ứng dụng FastAPI.
    Đăng ký CORS middleware cho phép frontend kết nối và nhúng toàn bộ API router.

    Returns:
        Instance ứng dụng FastAPI đã được cấu hình đầy đủ.
    """
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.VERSION,
        docs_url="/docs"
    )

    # Cấu hình middleware kiểm soát truy cập chéo nguồn (CORS)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Nhúng router tổng hợp (REST routes và WebSocket handlers)
    app.include_router(api_router)

    @app.get("/health")
    def health_check():
        """Endpoint kiểm tra trạng thái hoạt động tức thời của máy chủ backend."""
        return {"status": "online", "engine": settings.APP_NAME}

    return app

# Khởi tạo đối tượng ứng dụng FastAPI
app = create_app()

if __name__ == "__main__":
    # Hỗ trợ đóng băng tiến trình khi đóng gói PyInstaller trên hệ điều hành Windows
    multiprocessing.freeze_support()
    uvicorn.run(
        app,
        host=settings.HOST,
        port=settings.PORT,
        reload=False,
        log_level="info"
    )
