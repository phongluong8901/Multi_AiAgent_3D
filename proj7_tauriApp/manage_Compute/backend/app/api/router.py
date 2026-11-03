from fastapi import APIRouter
from app.api.rest import system_routes, process_routes, workflow_routes
from app.api.ws import telemetry_ws, log_stream_ws

api_router = APIRouter()

# Gắn các cụm REST API (chuẩn Postman Inspector)
api_router.include_router(system_routes.router, prefix="/api/rest")
api_router.include_router(process_routes.router, prefix="/api/rest")
api_router.include_router(workflow_routes.router, prefix="/api/rest")

# Gắn các cổng WebSocket (Realtime Telemetry & Console Log Stream)
api_router.include_router(telemetry_ws.router)
api_router.include_router(log_stream_ws.router)