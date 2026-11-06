"""
Kênh truyền thông WebSocket truyền luồng Log trực tiếp (Log Stream WebSocket):
Truyền dữ liệu đầu ra tiêu chuẩn (stdout / stderr) theo thời gian thực của các tiến trình con
được quản lý bởi Compute Studio lên bảng điều khiển Console ở Frontend.
"""

import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.modules.service_manager.os_process import process_manager

router = APIRouter()

@router.websocket("/ws/logs/{pid}")
async def stream_process_stdout(websocket: WebSocket, pid: int):
    """
    Truyền dữ liệu log stdout thời gian thực của một tiến trình con cụ thể theo PID.

    Tham số:
        websocket (WebSocket): Đối tượng kết nối WebSocket với client.
        pid (int): Mã tiến trình con được spawn cần theo dõi log.
    """
    await websocket.accept()
    proc = process_manager.managed_subprocesses.get(pid)
    if not proc or not proc.stdout:
        await websocket.send_json({"error": f"PID {pid} is not a managed subprocess or has no stdout pipe."})
        await websocket.close()
        return

    try:
        loop = asyncio.get_running_loop()
        # Đọc từng dòng log cho đến khi tiến trình kết thúc
        while proc.poll() is None:
            line = await loop.run_in_executor(None, proc.stdout.readline)
            if line:
                await websocket.send_json({"pid": pid, "log": line.rstrip()})
            else:
                await asyncio.sleep(0.1)
        # Thông báo khi tiến trình đã kết thúc kèm mã thoát (returncode)
        await websocket.send_json({"pid": pid, "status": "process_exited", "code": proc.returncode})
    except WebSocketDisconnect:
        # Ngắt kết nối khi client đóng tab hoặc dừng lắng nghe
        pass
