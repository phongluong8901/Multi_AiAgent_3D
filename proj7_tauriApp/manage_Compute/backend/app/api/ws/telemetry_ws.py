"""
Kênh truyền thông WebSocket đo lường từ xa (Realtime Telemetry WebSocket):
Phát liên tục dữ liệu trạng thái tài nguyên phần cứng (CPU, RAM, GPU, Mạng, Ổ đĩa)
tới Frontend theo chu kỳ được cấu hình trong settings.
"""

import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.modules.telemetry.collector import telemetry_collector
from app.core.config import settings

router = APIRouter()

@router.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    """
    Endpoint WebSocket phát luồng dữ liệu Telemetry liên tục tới client.
    Tự động ngắt kết nối an toàn khi client đóng kết nối mà không làm treo server.
    """
    await websocket.accept()
    try:
        while True:
            # Thu thập bản chụp hệ thống mới nhất
            snapshot = telemetry_collector.get_snapshot()
            # Gửi dữ liệu dưới dạng JSON
            await websocket.send_json(snapshot.model_dump())
            # Nghỉ theo chu kỳ lấy mẫu trước lượt phát kế tiếp
            await asyncio.sleep(settings.TELEMETRY_INTERVAL_SEC)
    except WebSocketDisconnect:
        # Client đóng kết nối hoặc chuyển trang
        pass
