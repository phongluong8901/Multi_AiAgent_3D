import json
from typing import Dict, List
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from app.schemas.interaction import RobotCommandRequest, RoomFirmwareStreamRequest
from app.services.room_bridge_service import room_bridge_service

router = APIRouter(prefix="/firmware", tags=["Room <-> Firmware Multi-Agent Stream Bridge"])

ACTIVE_WS_CLIENTS: Dict[str, WebSocket] = {}


@router.post("/simulate-command")
async def simulate_command(req: RobotCommandRequest):
    return await room_bridge_service.simulate_and_persist(req)


@router.post("/room-stream")
async def stream_room_firmware_post(req: RoomFirmwareStreamRequest):
    return StreamingResponse(
        room_bridge_service.stream_and_persist(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/room-stream")
async def stream_room_firmware_get(
    prompt: str = Query(..., description="Câu nói từ người dùng qua ESP32/ESP32-S3"),
    room_id: str = Query(default="default_room"),
    device_id: str = Query(default="esp32_s3_rover_01"),
    board_type: str = Query(default="esp32_s3"),
    agent_id: str = Query(default="agent_manager"),
    connection_type: str = Query(default="wifi"),
    transport_protocol: str = Query(default="sse"),
):
    req = RoomFirmwareStreamRequest(
        prompt=prompt,
        room_id=room_id,
        device_id=device_id,
        board_type=board_type,
        agent_id=agent_id,
        connection_type=connection_type,  # type: ignore[arg-type]
        transport_protocol=transport_protocol,  # type: ignore[arg-type]
    )
    return StreamingResponse(
        room_bridge_service.stream_and_persist(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/http/chat")
async def http_transport_chat(req: RoomFirmwareStreamRequest):
    steps: List[Dict] = []
    tokens: List[str] = []
    actions: List[Dict] = []
    final_data: Dict = {}

    async for raw_line in room_bridge_service.stream_and_persist(req):
        if not raw_line.startswith("data:"):
            continue
        ev = json.loads(raw_line[5:].strip())
        t = ev.get("type")
        if t in ("agent_step", "tool_start", "tool_end"):
            steps.append(ev)
        elif t == "token":
            tokens.append(ev.get("content", ""))
        elif t == "action":
            actions.append(ev)
        elif t == "done":
            final_data = ev

    return {
        "success": True,
        "transport": "http",
        "room_id": req.room_id,
        "device_id": req.device_id,
        "agent_id": req.agent_id,
        "steps": steps,
        "actions": final_data.get("actions", actions),
        "response_message": final_data.get("response_message", "".join(tokens).strip()),
    }


@router.post("/espnow/frame")
async def espnow_transport_packager(req: RoomFirmwareStreamRequest):
    req.transport_protocol = "esp_now"
    frames: List[Dict] = []
    seq = 0
    async for raw_line in room_bridge_service.stream_and_persist(req):
        if not raw_line.startswith("data:"):
            continue
        ev = json.loads(raw_line[5:].strip())
        if ev.get("type") == "token":
            seq += 1
            chunk_str = ev.get("content", "")
            frames.append({
                "seq_id": seq,
                "frame_type": 1,
                "agent_id": req.agent_id[:23],
                "text_chunk": chunk_str[:180],
                "byte_length": len(chunk_str.encode("utf-8")) + 47,
            })
        elif ev.get("type") == "action":
            seq += 1
            frames.append({
                "seq_id": seq,
                "frame_type": 2,
                "agent_id": req.agent_id[:23],
                "action_type": ev.get("action_type", "STOP")[:15],
                "action_value": ev.get("value", 0),
                "text_chunk": ev.get("description", "")[:180],
                "byte_length": 64,
            })

    total = len(frames)
    for f in frames:
        f["total_frames"] = total

    return {
        "success": True,
        "transport": "esp_now",
        "room_id": req.room_id,
        "device_id": req.device_id,
        "total_frames": total,
        "frames": frames,
    }


@router.post("/mqtt/publish")
async def mqtt_transport_bridge(req: RoomFirmwareStreamRequest):
    req.transport_protocol = "mqtt"
    packets: List[Dict] = []
    topic_stream = f"multiagent/room/{req.room_id}/device/{req.device_id}/stream"
    topic_action = f"multiagent/room/{req.room_id}/device/{req.device_id}/action"

    async for raw_line in room_bridge_service.stream_and_persist(req):
        if not raw_line.startswith("data:"):
            continue
        ev = json.loads(raw_line[5:].strip())
        if ev.get("type") in ("token", "agent_step", "done"):
            packets.append({"topic": topic_stream, "qos": 0, "payload": ev})
        elif ev.get("type") == "action":
            packets.append({"topic": topic_action, "qos": 1, "payload": ev})

    return {
        "success": True,
        "transport": "mqtt",
        "topic_stream": topic_stream,
        "topic_action": topic_action,
        "packet_count": len(packets),
        "packets": packets,
    }


@router.websocket("/ws/{device_id}")
async def firmware_websocket_endpoint(websocket: WebSocket, device_id: str):
    await websocket.accept()
    ACTIVE_WS_CLIENTS[device_id] = websocket
    await websocket.send_json({
        "type": "connected",
        "device_id": device_id,
        "message": f"Đã kết nối kênh WebSocket Firmware cho thiết bị {device_id}",
    })
    try:
        while True:
            raw_msg = await websocket.receive_text()
            try:
                data = json.loads(raw_msg)
            except Exception:
                data = {"prompt": raw_msg}

            req = RoomFirmwareStreamRequest(
                prompt=data.get("prompt", "Thời tiết hôm nay thế nào?"),
                room_id=data.get("room_id", "default_room"),
                device_id=device_id,
                board_type=data.get("board_type", "esp32_s3"),
                agent_id=data.get("agent_id", "agent_manager"),
                connection_type=data.get("connection_type", "wifi"),
                transport_protocol="websocket",
                obstacle_distance=float(data.get("obstacle_distance", 150.0)),
            )
            async for sse_line in room_bridge_service.stream_and_persist(req):
                if sse_line.startswith("data:"):
                    ev = json.loads(sse_line[5:].strip())
                    await websocket.send_json(ev)
    except WebSocketDisconnect:
        ACTIVE_WS_CLIENTS.pop(device_id, None)
    except Exception:
        ACTIVE_WS_CLIENTS.pop(device_id, None)

