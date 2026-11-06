"""
Diem khoi chay ung dung FastAPI cho AI Core Service (`main.py`):
- Dang ky Middleware CORS cho phep Client Frontend va Gateway truy cap
- Endpoint kiem tra tinh trang hoat dong `/health`
- Tich hop router API nghiep vu `/api/v1`
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routes import router

app = FastAPI(title="Self-Learning AI Core Service")

# Dang ky middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    """
    Endpoint kiem tra trang thai song con (Healthcheck) cua AI Core Service.
    """
    return {"status": "ok"}


# Dinh tuyen cac API nghiep vu cua AI Core
app.include_router(router, prefix="/api/v1")
