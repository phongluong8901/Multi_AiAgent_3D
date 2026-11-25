from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.api.deps import get_db
from app.services.agent_runner import agent_runner

router = APIRouter(prefix="/agents", tags=["Agent Interaction"])


class AgentChatRequest(BaseModel):
    message: str
    room_id: Optional[str] = None
    context: Optional[dict] = None
    active_agents: Optional[list] = None


@router.post("/{agent_id}/chat")
def chat_with_specific_agent(
    agent_id: str,
    payload: AgentChatRequest,
    db: Session = Depends(get_db),
):
    """
    Chat trực tiếp với một Agent 3D cụ thể.
    - Tự động nạp prompt và tools từ DB
    - Inject short memory (Redis) và long memory (PostgreSQL)
    - Publish kết quả lên RabbitMQ để các service khác lắng nghe
    """
    ctx = payload.context or {}
    if payload.active_agents:
        ctx["activeAgents"] = payload.active_agents

    result = agent_runner.run_agent(
        db=db,
        agent_id=agent_id,
        user_message=payload.message,
        room_id=payload.room_id,
        source="http",
        context=ctx,
    )
    return result


@router.post("/{agent_id}/chat/stream")
def stream_chat_with_specific_agent(
    agent_id: str,
    payload: AgentChatRequest,
    db: Session = Depends(get_db),
):
    """
    Chat trực tiếp với Agent hỗ trợ Streaming dữ liệu (Server-Sent Events - SSE):
    - Stream tiến trình suy nghĩ (thinking)
    - Stream sự kiện gọi tool (tool_start, tool_end)
    - Stream từng token văn bản thời gian thực (token)
    - Trả về sự kiện hoàn thành (done)
    """
    ctx = payload.context or {}
    if payload.active_agents:
        ctx["activeAgents"] = payload.active_agents

    event_generator = agent_runner.stream_agent(
        db=db,
        agent_id=agent_id,
        user_message=payload.message,
        room_id=payload.room_id,
        source="http",
        context=ctx,
    )
    return StreamingResponse(
        event_generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )