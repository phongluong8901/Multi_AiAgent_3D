"""
Repository chuyên biệt cho thực thể `AgentModel` (`AgentRepository`).
Hỗ trợ truy vấn Agent kèm quan hệ `tools`/`prompt` và cập nhật bảng trung gian `agent_tools`.
"""

from sqlalchemy.orm import Session
from app.models.agent import AgentModel
from app.models.tool import ToolModel
from app.repositories.base_repository import BaseRepository
from typing import Optional, List


class AgentRepository(BaseRepository[AgentModel]):
    """Quản lý truy vấn dữ liệu bảng `agents` và liên kết nhiều-nhiều với bảng `tools`."""

    def __init__(self):
        super().__init__(AgentModel)

    def get_with_relations(self, db: Session, agent_id: str) -> Optional[AgentModel]:
        """Lấy thông tin Agent theo `agent_id` kèm danh sách công cụ và prompt."""
        return db.query(AgentModel).filter(AgentModel.id == agent_id).first()

    def update_agent_tools(
        self, db: Session, agent: AgentModel, tool_ids: List[str]
    ) -> AgentModel:
        """Cập nhật danh sách công cụ (`tools`) được gán cho một Agent."""
        tools = db.query(ToolModel).filter(ToolModel.id.in_(tool_ids)).all()
        agent.tools = tools
        db.commit()
        db.refresh(agent)
        return agent


agent_repository = AgentRepository()
