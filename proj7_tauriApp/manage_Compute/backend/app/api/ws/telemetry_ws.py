import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.modules.telemetry.collector import telemetry_collector
from app.core.config import settings

router = APIRouter()

@router.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            snapshot = telemetry_collector.get_snapshot()
            await websocket.send_json(snapshot.model_dump())
            await asyncio.sleep(settings.TELEMETRY_INTERVAL_SEC)
    except WebSocketDisconnect:
        pass