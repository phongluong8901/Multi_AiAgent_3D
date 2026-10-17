from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.api.deps import get_db
from app.services.agent_runner import agent_runner

router = APIRouter(prefix="/agents", tags=["Agent Interaction"])


class AgentChatRequest(BaseModel):
    message: str
    room_id: Optional[str] = None


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
    result = agent_runner.run_agent(
        db=db,
        agent_id=agent_id,
        user_message=payload.message,
        room_id=payload.room_id,
    )
    return result