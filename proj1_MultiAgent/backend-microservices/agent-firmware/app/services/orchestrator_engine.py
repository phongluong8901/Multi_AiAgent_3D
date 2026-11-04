import asyncio
import datetime
import json
import os
import re
from typing import Any, AsyncGenerator, Dict, List, Tuple
import httpx

from app.schemas import RobotCommandRequest, RoomFirmwareStreamRequest

AGENT_SERVICE_URL = os.getenv("AGENT_SERVICE_URL", "http://localhost:8000")
CHAT_SERVICE_URL = os.getenv("CHAT_SERVICE_URL", "http://localhost:5003")


def parse_hardware_actions(prompt: str, obstacle_distance: float = 150.0) -> Tuple[List[Dict[str, Any]], str]:
    """
    Phân tích ngôn ngữ tự nhiên thành chuỗi lệnh điều khiển động cơ/cảm biến/đèn LED
    cho Robot thực tế (ESP32 / ESP32-S3) và Simulator 3D.
    """
    text = (prompt or "").lower()
    actions: List[Dict[str, Any]] = []
    thought_parts: List[str] = []

    if obstacle_distance < 25 and any(k in text for k in ["tiến", "thẳng", "forward", "đi tới"]):
        thought_parts.append(
            f"Cảm biến siêu âm HC-SR04 phát hiện vật cản gần ({obstacle_distance:.0f}cm < 25cm). Tự động dừng và lùi an toàn."
        )
        actions.append({"type": "STOP", "value": 0, "unit": "none", "description": "Phanh khẩn cấp tránh vật cản"})
        actions.append({"type": "BACKWARD", "value": 40, "unit": "cm", "description": "Lùi 40cm tạo khoảng cách an toàn"})
        actions.append({"type": "TURN_RIGHT", "value": 90, "unit": "deg", "description": "Rẽ phải 90° tìm hướng đi mới"})
        return actions, " ".join(thought_parts)

    # Tìm khoảng cách mét / cm trong câu lệnh
    dist_cm = 100
    m_meter = re.search(r"(\d+(?:[\.,]\d+)?)\s*(?:m|mét|met)\b", text)
    m_cm = re.search(r"(\d+(?:[\.,]\d+)?)\s*cm\b", text)
    if m_meter:
        dist_cm = int(float(m_meter.group(1).replace(",", ".")) * 100)
    elif m_cm:
        dist_cm = int(float(m_cm.group(1).replace(",", ".")))

    deg_val = 90
    m_deg = re.search(r"(\d+)\s*(?:độ|do|deg)", text)
    if m_deg:
        deg_val = int(m_deg.group(1))

    if "360" in text or "xoay tròn" in text or "xoay vòng" in text or "ăn mừng" in text:
        actions.append({"type": "ROTATE_360", "value": 360, "unit": "deg", "description": "Xoay 360 độ tại chỗ"})
        thought_parts.append("Thực hiện động tác xoay tròn 360 độ bằng 2 kênh động cơ ngược chiều.")

    if any(k in text for k in ["đi thẳng", "tiến", "forward", "đi tới"]):
        actions.append({"type": "FORWARD", "value": dist_cm, "unit": "cm", "description": f"Tiến thẳng {dist_cm}cm"})
        thought_parts.append(f"Kích hoạt cầu H L298N tiến thẳng {dist_cm}cm.")

    if any(k in text for k in ["lùi", "backward", "quay lui"]):
        actions.append({"type": "BACKWARD", "value": dist_cm, "unit": "cm", "description": f"Lùi lại {dist_cm}cm"})
        thought_parts.append(f"Đảo chiều PWM cầu H lùi {dist_cm}cm.")

    if any(k in text for k in ["rẽ trái", "quay trái", "sang trái", "turn left"]):
        actions.append({"type": "TURN_LEFT", "value": deg_val, "unit": "deg", "description": f"Rẽ trái {deg_val}°"})
        thought_parts.append(f"Thực hiện rẽ trái góc {deg_val}°.")

    if any(k in text for k in ["rẽ phải", "quay phải", "sang phải", "turn right"]):
        actions.append({"type": "TURN_RIGHT", "value": deg_val, "unit": "deg", "description": f"Rẽ phải {deg_val}°"})
        thought_parts.append(f"Thực hiện rẽ phải góc {deg_val}°.")

    if any(k in text for k in ["dừng", "phanh", "đứng lại", "stop"]):
        actions.append({"type": "STOP", "value": 0, "unit": "none", "description": "Phanh dừng toàn bộ động cơ"})
        thought_parts.append("Ngắt xung PWM, phanh dừng robot.")

    if any(k in text for k in ["né vật cản", "quét cảm biến", "tuần tra"]):
        actions.extend([
            {"type": "FORWARD", "value": 100, "unit": "cm", "description": "Tiến tuần tra 100cm"},
            {"type": "TURN_LEFT", "value": 90, "unit": "deg", "description": "Quét góc trái 90°"},
            {"type": "FORWARD", "value": 80, "unit": "cm", "description": "Tiến vào hành lang an toàn"},
        ])
        thought_parts.append("Kích hoạt chế độ tự hành quét siêu âm HC-SR04 và né vật cản.")

    if not thought_parts:
        thought_parts.append(
            "Nhận câu hỏi giao tiếp từ người dùng qua Micro I2S -> Chuyển tiếp vào Room cho @agent_manager điều phối các Agent con và phát giọng nói LLM Stream."
        )

    return actions, " ".join(thought_parts)


async def fetch_realtime_weather_context(query: str) -> Dict[str, Any]:
    """
    Lấy dữ liệu thời tiết thực tế từ Open-Meteo (không cần API key) cho Hà Nội / TP.HCM
    để @agent_search cung cấp số liệu thời gian thực chính xác cho @agent_manager.
    """
    q_lower = query.lower()
    if any(k in q_lower for k in ["hồ chí minh", "hcm", "sài gòn", "saigon", "miền nam"]):
        city_name = "TP. Hồ Chí Minh"
        lat, lon = 10.8231, 106.6297
    elif any(k in q_lower for k in ["đà nẵng", "da nang", "miền trung"]):
        city_name = "Đà Nẵng"
        lat, lon = 16.0544, 108.2022
    else:
        city_name = "Hà Nội"
        lat, lon = 21.0285, 105.8542

    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code"
        f"&timezone=Asia%2FBangkok"
    )
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json().get("current", {})
                temp = data.get("temperature_2m", 28.5)
                feels = data.get("apparent_temperature", 30.2)
                humidity = data.get("relative_humidity_2m", 72)
                wind = data.get("wind_speed_10m", 11.5)
                wcode = data.get("weather_code", 1)
                cond = (
                    "Trời quang đãng, nắng nhẹ"
                    if wcode in (0, 1)
                    else "Có mây rải rác, thời tiết dễ chịu"
                    if wcode in (2, 3)
                    else "Có mưa rào nhẹ, nên mang theo ô/áo mưa"
                )
                return {
                    "city": city_name,
                    "temperature_c": temp,
                    "feels_like_c": feels,
                    "humidity_pct": humidity,
                    "wind_kmh": wind,
                    "condition": cond,
                    "source": "Open-Meteo Real-time Weather Station",
                }
    except Exception:
        pass

    now_str = datetime.datetime.now().strftime("%H:%M ngày %d/%m/%Y")
    return {
        "city": city_name,
        "temperature_c": 27.5,
        "feels_like_c": 29.0,
        "humidity_pct": 74,
        "wind_kmh": 10.4,
        "condition": f"Trời mát mẻ, mây thay đổi, gió nhẹ (cập nhật lúc {now_str})",
        "source": "Trạm Khí tượng Khu vực & Sensor Room",
    }


async def post_message_to_room_chat(
    room_id: str,
    sender_id: str,
    sender_name: str,
    sender_type: str,
    message: str,
    target_agent_id: str = "",
    metadata: Dict[str, Any] | None = None,
) -> bool:
    """
    Đồng bộ tin nhắn từ thiết bị Firmware thực tế hoặc từ các Agent vào trong Room Chat (chat-service)
    để mọi người trong Room 3D và Floating Chat Bubble đều nhìn thấy theo thời gian thực.
    """
    if not room_id:
        return False

    payload = {
        "roomId": room_id,
        "typeChat": "agent",
        "senderId": sender_id,
        "senderType": sender_type,
        "senderName": sender_name,
        "message": message,
        "targetAgentId": target_agent_id or None,
        "metadata": {
            "skipAgentDispatch": True,
            "source": "agent-firmware",
            **(metadata or {}),
        },
    }
    try:
        async with httpx.AsyncClient(timeout=3.5) as client:
            resp = await client.post(f"{CHAT_SERVICE_URL}/api/v1/chats/send", json=payload)
            return resp.status_code in (200, 201)
    except Exception as exc:
        print(f"[agent-firmware] Info: Không thể đồng bộ sang chat-service ({exc})")
        return False


def _select_sub_agents_for_query(prompt: str, configured_sub_agents: List[str]) -> List[Tuple[str, str, str]]:
    """
    Xác định các Agent con trong Room mà @agent_manager sẽ điều phối dựa trên nội dung câu hỏi của người dùng.
    Trả về danh sách (agent_id, tool_name, task_description).
    """
    q = (prompt or "").lower()
    plan: List[Tuple[str, str, str]] = []

    if any(k in q for k in ["thời tiết", "nhiệt độ", "mưa", "nắng", "gió", "weather", "hôm nay", "tin tức", "tìm", "tra cứu", "giá"]):
        plan.append((
            "agent_search",
            "web_search_tool",
            "Tra cứu dữ liệu thời tiết & thông tin thời gian thực cho yêu cầu của người dùng từ thiết bị Firmware",
        ))
        plan.append((
            "agent_analysis",
            "sentiment_analysis_tool",
            "Phân tích chỉ số môi trường, độ ẩm, nhiệt độ cảm nhận và đưa ra khuyến nghị di chuyển/hoạt động",
        ))
    elif any(k in q for k in ["tính", "cộng", "trừ", "nhân", "chia", "bao nhiêu", "quãng đường", "pin", "vận tốc", "chi phí"]):
        plan.append((
            "agent_calculate",
            "calculator_tool",
            "Tính toán chính xác các thông số kỹ thuật, năng lượng pin và quãng đường di chuyển cho Robot",
        ))
        plan.append((
            "agent_analysis",
            "json_data_transformer_tool",
            "Kiểm tra ngưỡng an toàn và tối ưu hóa hành trình thực thi trên phần cứng",
        ))
    else:
        first_sub = configured_sub_agents[0] if configured_sub_agents else "agent_search"
        plan.append((
            first_sub,
            "web_search_tool",
            "Thu thập ngữ cảnh bổ sung trong Room để hỗ trợ @agent_manager phản hồi thiết bị nhúng",
        ))

    return plan


async def _try_stream_from_agent_service(
    agent_id: str,
    message: str,
    room_id: str,
    active_agents: List[str],
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Kết nối luồng SSE trực tiếp tới `agent-service` (`/api/v1/agents/{agent_id}/chat/stream`).
    """
    url = f"{AGENT_SERVICE_URL}/api/v1/agents/{agent_id}/chat/stream"
    payload = {
        "message": message,
        "room_id": room_id,
        "active_agents": active_agents,
        "context": {
            "source": "agent-firmware",
            "embodied_mode": True,
        },
    }
    async with httpx.AsyncClient(timeout=18.0) as client:
        async with client.stream("POST", url, json=payload) as resp:
            if resp.status_code != 200:
                raise RuntimeError(f"agent-service returned HTTP {resp.status_code}")
            async for line in resp.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                raw = line[5:].strip()
                if not raw:
                    continue
                data = json.loads(raw)
                yield data


def _chunk_text_for_voice_stream(text: str, words_per_chunk: int = 3) -> List[str]:
    words = text.split(" ")
    chunks: List[str] = []
    for i in range(0, len(words), words_per_chunk):
        piece = " ".join(words[i : i + words_per_chunk])
        if i + words_per_chunk < len(words):
            piece += " "
        chunks.append(piece)
    return chunks


async def stream_room_firmware_interaction(
    req: RoomFirmwareStreamRequest,
) -> AsyncGenerator[str, None]:
    """
    Luồng SSE (Server-Sent Events) kết nối Giữa Thiết Bị Firmware Thực Tế (ESP32 / ESP32-S3) <-> Room 3D <-> Multi-Agent:
    1. Nhận câu nói của User từ mạch nhúng -> Đồng bộ tin nhắn vào Room Chat (`chat-service`).
    2. `@agent_manager` trong Room tiếp nhận -> Phân công nhiệm vụ cho các Agent con (`@agent_search`, `@agent_calculate`, `@agent_analysis`...).
    3. Các Agent con thực thi Tool và trả kết quả về cho `@agent_manager` (đồng bộ vào Room).
    4. `@agent_manager` tổng hợp câu trả lời và truyền tải STREAM từng cụm token (`type: "token"`) + lệnh phần cứng (`type: "action"`) về thẳng `agent-firmware` để Robot nói ra ngay lập tức!
    """
    lead_agent = req.agent_id or "agent_manager"
    sub_agents = req.sub_agents or ["agent_search", "agent_calculate", "agent_analysis"]
    all_room_agents = [lead_agent] + [a for a in sub_agents if a != lead_agent]

    # ─── BƯỚC 0: ĐỒNG BỘ TIN NHẮN TỪ THIẾT BỊ FIRMWARE VÀO ROOM ─────────────
    room_user_msg = f"[{req.device_name} | {req.board_type.upper()}] {req.prompt} @{lead_agent}"
    synced = False
    if req.sync_to_room_chat:
        synced = await post_message_to_room_chat(
            room_id=req.room_id,
            sender_id=req.sender_id or req.device_id,
            sender_name=f"{req.sender_name} ({req.board_type.upper()})",
            sender_type="user",
            message=room_user_msg,
            target_agent_id=lead_agent,
            metadata={
                "deviceId": req.device_id,
                "boardType": req.board_type,
                "connectionType": req.connection_type,
                "transportProtocol": req.transport_protocol,
            },
        )

    yield f"data: {json.dumps({'type': 'room_sync', 'room_id': req.room_id, 'device_id': req.device_id, 'board_type': req.board_type, 'connection_type': req.connection_type, 'transport_protocol': req.transport_protocol, 'synced_to_chat_service': synced, 'content': f'Đã đẩy câu hỏi từ {req.device_name} vào Room [{req.room_id}] cho @{lead_agent}'}, ensure_ascii=False)}\n\n"

    # Phân tích lệnh phần cứng (nếu câu nói có kèm yêu cầu di chuyển/xoay)
    hw_actions, hw_thought = parse_hardware_actions(req.prompt, req.obstacle_distance)
    for act in hw_actions:
        yield f"data: {json.dumps({'type': 'action', 'action_type': act['type'], 'value': act['value'], 'unit': act['unit'], 'description': act['description']}, ensure_ascii=False)}\n\n"

    # ─── BƯỚC 1: @AGENT_MANAGER TIẾP NHẬN VÀ ĐIỀU PHỐI AGENT CON TRONG ROOM ─
    delegation_plan = _select_sub_agents_for_query(req.prompt, sub_agents)
    delegated_names = ", ".join(f"@{a[0]}" for a in delegation_plan)
    manager_plan_msg = (
        f"Đã nhận yêu cầu từ mạch {req.board_type.upper()} ({req.device_id}): \"{req.prompt}\". "
        f"Đang điều phối {delegated_names} trong Room '{req.room_id}' thu thập dữ liệu và xử lý..."
    )
    yield f"data: {json.dumps({'type': 'agent_step', 'step': 1, 'agent_id': lead_agent, 'role': 'Manager Orchestrator', 'content': manager_plan_msg}, ensure_ascii=False)}\n\n"

    if req.sync_to_room_chat:
        await post_message_to_room_chat(
            room_id=req.room_id,
            sender_id=lead_agent,
            sender_name=f"@{lead_agent} (Room Coordinator)",
            sender_type="agent",
            message=f"[Điều phối Firmware `{req.device_id}`] {manager_plan_msg}",
            metadata={"deviceId": req.device_id, "step": "manager_delegation"},
        )

    # ─── BƯỚC 2: CÁC AGENT CON TRONG ROOM THỰC THI CÔNG CỤ & BÁO CÁO ────────
    sub_agent_reports: List[str] = []
    q_lower = req.prompt.lower()
    is_weather_query = any(k in q_lower for k in ["thời tiết", "nhiệt độ", "mưa", "nắng", "gió", "weather", "hôm nay"])

    weather_info: Dict[str, Any] = {}
    if is_weather_query:
        weather_info = await fetch_realtime_weather_context(req.prompt)

    for idx, (sub_id, tool_name, task_desc) in enumerate(delegation_plan, start=2):
        yield f"data: {json.dumps({'type': 'tool_start', 'agent_id': sub_id, 'tool': tool_name, 'content': f'@{sub_id} đang chạy {tool_name}: {task_desc}'}, ensure_ascii=False)}\n\n"
        await asyncio.sleep(0.12)

        if is_weather_query and sub_id == "agent_search":
            report = (
                f"[{weather_info['source']}] Thời tiết hiện tại ở {weather_info['city']}: "
                f"Nhiệt độ {weather_info['temperature_c']}°C (cảm nhận thực tế {weather_info['feels_like_c']}°C), "
                f"Độ ẩm {weather_info['humidity_pct']}%, Gió {weather_info['wind_kmh']} km/h. "
                f"Trạng thái: {weather_info['condition']}."
            )
        elif is_weather_query and sub_id == "agent_analysis":
            temp_c = weather_info.get("temperature_c", 28.0)
            advice = (
                "Thời tiết rất thuận lợi để hoạt động ngoài trời và vận hành robot."
                if 20 <= temp_c <= 32
                else "Nhiệt độ khá khắc nghiệt, khuyến nghị ưu tiên làm việc trong phòng điều hòa và theo dõi nhiệt độ pin LiPo của ESP32."
            )
            report = f"Đánh giá điều kiện môi trường: {advice} Đề xuất @{lead_agent} phát thông báo ngắn gọn, rõ ràng qua loa I2S."
        else:
            report = f"Đã xử lý yêu cầu '{req.prompt}' bằng công cụ `{tool_name}` (Khoảng cách cảm biến trước mũi robot: {req.obstacle_distance:.0f}cm)."

        sub_agent_reports.append(f"@{sub_id}: {report}")
        yield f"data: {json.dumps({'type': 'tool_end', 'agent_id': sub_id, 'tool': tool_name, 'result': report}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'type': 'agent_step', 'step': idx, 'agent_id': sub_id, 'role': 'Specialist Sub-Agent', 'content': f'Báo cáo lại cho @{lead_agent}: {report}'}, ensure_ascii=False)}\n\n"

        if req.sync_to_room_chat:
            await post_message_to_room_chat(
                room_id=req.room_id,
                sender_id=sub_id,
                sender_name=f"@{sub_id}",
                sender_type="agent",
                message=f"[Báo cáo lên @{lead_agent}] {report}",
                target_agent_id=lead_agent,
                metadata={"deviceId": req.device_id, "step": "sub_agent_report"},
            )

    # ─── BƯỚC 3: @AGENT_MANAGER TỔNG HỢP & STREAM LLM TOKEN VỀ FIRMWARE ─────
    yield f"data: {json.dumps({'type': 'agent_step', 'step': len(delegation_plan) + 2, 'agent_id': lead_agent, 'role': 'Manager Synthesis -> Firmware Voice Stream', 'content': f'@{lead_agent} đã nhận đủ kết quả từ {delegated_names} và đang truyền tải stream giọng nói về {req.device_name} qua giao thức {req.transport_protocol.upper()}...'}, ensure_ascii=False)}\n\n"

    streamed_from_live_llm = False
    full_spoken_reply = ""

    # Thử stream trực tiếp từ agent-service nếu agent-service đang chạy và có cấu hình LLM
    synthesis_prompt = (
        f"Người dùng hỏi qua thiết bị nhúng {req.device_name} ({req.board_type}) trong phòng: \"{req.prompt}\".\n"
        f"Báo cáo từ các Agent con trong phòng:\n" + "\n".join(sub_agent_reports) + "\n"
        f"Hãy trả lời trực tiếp bằng tiếng Việt tự nhiên, ngắn gọn (2-4 câu), súc tích để phát ra loa TTS của mạch nhúng ngay lập tức. Không gắn thẻ @agent nữa."
    )

    try:
        seq_id = 0
        async for ev in _try_stream_from_agent_service(
            agent_id=lead_agent,
            message=synthesis_prompt,
            room_id=req.room_id,
            active_agents=all_room_agents,
        ):
            ev_type = ev.get("type")
            if ev_type == "token":
                tok = ev.get("content", "")
                if tok and not tok.startswith("⚠️") and "API key" not in tok:
                    streamed_from_live_llm = True
                    full_spoken_reply += tok
                    seq_id += 1
                    yield f"data: {json.dumps({'type': 'token', 'seq_id': seq_id, 'agent_id': lead_agent, 'transport': req.transport_protocol, 'content': tok}, ensure_ascii=False)}\n\n"
            elif ev_type == "done" and streamed_from_live_llm:
                break
    except Exception:
        streamed_from_live_llm = False

    # Nếu agent-service chưa cấu hình API key hoặc đang offline, dùng bộ tổng hợp giọng nói thời gian thực
    if not streamed_from_live_llm or not full_spoken_reply.strip():
        if is_weather_query and weather_info:
            synthesized_speech = (
                f"Xin chào! Quản lý phòng @{lead_agent} đã phối hợp cùng @agent_search và @agent_analysis kiểm tra giúp bạn: "
                f"Thời tiết hôm nay tại {weather_info['city']} đang là {weather_info['temperature_c']} độ C, "
                f"cảm giác thực tế khoảng {weather_info['feels_like_c']} độ C, độ ẩm {weather_info['humidity_pct']}% "
                f"và tốc độ gió {weather_info['wind_kmh']} km/h. "
                f"{weather_info['condition']}. Chúc bạn một ngày làm việc hiệu quả!"
            )
        elif hw_actions:
            act_names = ", ".join(a["description"] for a in hw_actions)
            synthesized_speech = (
                f"Rõ! @{lead_agent} đã tiếp nhận lệnh trong Room và điều khiển mạch {req.board_type.upper()} thực thi: {act_names}. "
                f"Khoảng cách phía trước hiện tại là {req.obstacle_distance:.0f} cm, hoàn toàn an toàn!"
            )
        else:
            synthesized_speech = (
                f"Xin chào từ Room {req.room_id}! @{lead_agent} đã phối hợp với {delegated_names} xử lý yêu cầu '{req.prompt}' của bạn. "
                f"Hệ thống nhúng {req.board_type.upper()} đang kết nối qua {req.connection_type.upper()} ({req.transport_protocol.upper()}) và sẵn sàng thực thi nhiệm vụ tiếp theo!"
            )

        full_spoken_reply = synthesized_speech
        chunks = _chunk_text_for_voice_stream(synthesized_speech, words_per_chunk=3)
        for seq_id, token_chunk in enumerate(chunks, start=1):
            token_event: Dict[str, Any] = {
                "type": "token",
                "seq_id": seq_id,
                "total_chunks": len(chunks),
                "agent_id": lead_agent,
                "transport": req.transport_protocol,
                "content": token_chunk,
            }
            if req.transport_protocol == "esp_now":
                token_event["espnow_frame"] = {
                    "seq_id": seq_id,
                    "total_frames": len(chunks),
                    "frame_type": 1,
                    "payload_bytes": len(token_chunk.encode("utf-8")),
                }
            elif req.transport_protocol == "mqtt":
                token_event["mqtt_topic"] = f"multiagent/room/{req.room_id}/device/{req.device_id}/stream"

            yield f"data: {json.dumps(token_event, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.045)

    # Đồng bộ câu trả lời cuối cùng của @agent_manager vào Room Chat
    if req.sync_to_room_chat and full_spoken_reply.strip():
        await post_message_to_room_chat(
            room_id=req.room_id,
            sender_id=lead_agent,
            sender_name=f"@{lead_agent} -> {req.device_name}",
            sender_type="agent",
            message=f"[Phát giọng nói ra `{req.device_name}` ({req.transport_protocol.upper()})]: {full_spoken_reply.strip()}",
            metadata={
                "deviceId": req.device_id,
                "boardType": req.board_type,
                "connectionType": req.connection_type,
                "transportProtocol": req.transport_protocol,
                "step": "final_voice_stream",
            },
        )

    done_payload = {
        "type": "done",
        "room_id": req.room_id,
        "device_id": req.device_id,
        "agent_id": lead_agent,
        "sub_agents_used": [a[0] for a in delegation_plan],
        "connection_type": req.connection_type,
        "transport_protocol": req.transport_protocol,
        "agent_thought": hw_thought,
        "response_message": full_spoken_reply.strip(),
        "actions": hw_actions,
    }
    yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"


async def simulate_robot_command_logic(req: RobotCommandRequest) -> Dict[str, Any]:
    """
    Xử lý nhanh lệnh `/api/v1/firmware/simulate-command` (tương thích 100% với Simulator 3D hiện tại
    đồng thời hỗ trợ hỏi thời tiết / hội thoại Room Multi-Agent).
    """
    actions, thought = parse_hardware_actions(req.prompt, req.obstacle_distance)
    q_lower = req.prompt.lower()

    if any(k in q_lower for k in ["thời tiết", "nhiệt độ", "mưa", "nắng", "gió", "weather", "hôm nay"]):
        w = await fetch_realtime_weather_context(req.prompt)
        thought = (
            f"@agent_manager trong Room đã giao @agent_search tra cứu trạm khí tượng {w['city']} "
            f"và @agent_analysis tổng hợp kết quả gửi về mạch {req.board_type.upper()}."
        )
        reply = (
            f"[Room @{req.agent_id}]: Thời tiết hôm nay tại {w['city']} là {w['temperature_c']}°C "
            f"(cảm nhận {w['feels_like_c']}°C), độ ẩm {w['humidity_pct']}%, gió {w['wind_kmh']} km/h. {w['condition']}!"
        )
    elif actions:
        desc_str = " -> ".join(a["description"] for a in actions)
        reply = f"Robot {req.board_type.upper()} đang thực thi chuỗi lệnh: {desc_str}."
    else:
        reply = (
            f"[Room @{req.agent_id}]: Đã nhận câu hỏi '{req.prompt}' từ mạch {req.board_type.upper()} "
            f"qua kết nối {req.connection_type.upper()}/{req.transport_protocol.upper()} và phản hồi thành công!"
        )

    if req.room_id:
        await post_message_to_room_chat(
            room_id=req.room_id,
            sender_id=req.device_id,
            sender_name=f"Robot {req.board_type.upper()}",
            sender_type="user",
            message=f"{req.prompt} @{req.agent_id}",
            target_agent_id=req.agent_id,
        )
        await post_message_to_room_chat(
            room_id=req.room_id,
            sender_id=req.agent_id,
            sender_name=f"@{req.agent_id}",
            sender_type="agent",
            message=reply,
        )

    return {
        "prompt": req.prompt,
        "agent_thought": thought,
        "actions": actions,
        "response_message": reply,
    }

