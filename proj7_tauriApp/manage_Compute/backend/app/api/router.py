"""
Bộ gom tuyến API trung tâm (Master API Router):
Tập hợp toàn bộ các router REST API (System, Processes, Workflows)
và các kênh WebSocket (Realtime Telemetry, Log Stream) vào một Router gốc duy nhất.
"""

from fastapi import APIRouter
from app.api.rest import system_routes, process_routes, workflow_routes
from app.api.ws import telemetry_ws, log_stream_ws

api_router = APIRouter()

# Đăng ký các nhóm tuyến REST API phục vụ giao diện bàn làm việc Workbench
api_router.include_router(system_routes.router, prefix="/api/rest")
api_router.include_router(process_routes.router, prefix="/api/rest")
api_router.include_router(workflow_routes.router, prefix="/api/rest")

# Đăng ký các kênh WebSocket truyền dữ liệu thời gian thực
api_router.include_router(telemetry_ws.router)
api_router.include_router(log_stream_ws.router)
