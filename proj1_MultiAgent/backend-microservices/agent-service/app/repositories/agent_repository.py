from sqlalchemy.orm import Session
from app.models.agent import AgentModel
from app.models.tool import ToolModel
from app.repositories.base_repository import BaseRepository
from typing import Optional, List

class AgentRepository(BaseRepository[AgentModel]):
    def __init__(self):
        super().__init__(AgentModel)

    def get_with_relations(self, db: Session, agent_id: str) -> Optional[AgentModel]:
        return db.query(AgentModel).filter(AgentModel.id == agent_id).first()

    def update_agent_tools(self, db: Session, agent: AgentModel, tool_ids: List[str]) -> AgentModel:
        tools = db.query(ToolModel).filter(ToolModel.id.in_(tool_ids)).all()
        agent.tools = tools
        db.commit()
        db.refresh(agent)
        return agent

agent_repository = AgentRepository()