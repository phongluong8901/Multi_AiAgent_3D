import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.modules.service_manager.os_process import process_manager

router = APIRouter()

@router.websocket("/ws/logs/{pid}")
async def stream_process_stdout(websocket: WebSocket, pid: int):
    """
    Stream realtime stdout/stderr của các tiến trình được bật qua API /processes/spawn
    để hiển thị lên khung Bottom Console giống Postman.
    """
    await websocket.accept()
    proc = process_manager.managed_subprocesses.get(pid)
    if not proc or not proc.stdout:
        await websocket.send_json({"error": f"PID {pid} is not a managed subprocess or has no stdout pipe."})
        await websocket.close()
        return

    try:
        loop = asyncio.get_running_loop()
        while proc.poll() is None:
            line = await loop.run_in_executor(None, proc.stdout.readline)
            if line:
                await websocket.send_json({"pid": pid, "log": line.rstrip()})
            else:
                await asyncio.sleep(0.1)
        await websocket.send_json({"pid": pid, "status": "process_exited", "code": proc.returncode})
    except WebSocketDisconnect:
        pass