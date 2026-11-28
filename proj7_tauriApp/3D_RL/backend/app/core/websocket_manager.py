from fastapi import WebSocket
from typing import List, Optional
import asyncio
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Quan ly toan bo ket noi WebSocket tu cac client (Frontend React / Tauri Desktop).
    Ho tro:
    - Ket noi va ngat ket noi linh hoat cho nhieu client dong thoi.
    - Phat song bat dong bo (async broadcast) trong vong lap asyncio.
    - Phat song dong bo (sync broadcast) tu cac callback huan luyen PPO chay tren thread rieng
      thong qua asyncio.run_coroutine_threadsafe.
    """

    def __init__(self):
        """Khoi tao danh sach ket noi active va bien giu event loop."""
        self.active_connections: List[WebSocket] = []
        self.loop: Optional[asyncio.AbstractEventLoop] = None

    async def connect(self, websocket: WebSocket):
        """
        Chap nhan ket noi WebSocket moi va luu vao danh sach active.

        Args:
            websocket (WebSocket): Doi tuong ket noi WebSocket tu client.
        """
        await websocket.accept()
        self.active_connections.append(websocket)
        try:
            self.loop = asyncio.get_running_loop()
        except RuntimeError:
            self.loop = None
        logger.info(f"[WS] Client connected. Total active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """
        Xoa ket noi WebSocket khoi danh sach active khi client dong hoac gap loi mang.

        Args:
            websocket (WebSocket): Doi tuong can ngat.
        """
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"[WS] Client disconnected. Total active connections: {len(self.active_connections)}")

    async def _broadcast_message(self, message: str):
        """
        Ham noi bo gui chuoi message JSON toi tat ca cac client dang ket noi.
        Tu dong loai bo cac client bi dut ket noi.
        """
        disconnected = []
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast(self, data: dict):
        """
        Phat song bat dong bo (Async Broadcast) du lieu dictionary toi toan bo client.

        Args:
            data (dict): Payload du lieu (toa do robot, telemetry, vi mach than kinh,...).
        """
        if not self.active_connections:
            return
        message = json.dumps(data)
        await self._broadcast_message(message)

    def broadcast_sync(self, data: dict):
        """
        Phat song dong bo (Sync Broadcast) duoc goi tu cac tien trinh huan luyen SB3
        hoac luong worker khong phai async.
        Su dung run_coroutine_threadsafe de chuyen giao viec gui tin nhan cho event loop chinh.

        Args:
            data (dict): Payload can phat song.
        """
        if not self.active_connections:
            return
        message = json.dumps(data)
        if self.loop is not None and self.loop.is_running():
            asyncio.run_coroutine_threadsafe(self._broadcast_message(message), self.loop)


# The hien quan ly WebSocket toan cuc
manager = ConnectionManager()
