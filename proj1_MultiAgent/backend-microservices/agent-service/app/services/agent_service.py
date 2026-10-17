from sqlalchemy.orm import Session
from app.repositories.agent_repository import agent_repository
from app.schemas.agent_schema import AgentCreate, AgentUpdate, AgentResponse
from fastapi import HTTPException

class AgentService:
    @staticmethod
    def format_response(agent) -> dict:
        return {
            "id": agent.id,
            "name": agent.name,
            "color": agent.color,
            "status": agent.status,
            "speech": agent.speech,
            "position": [agent.pos_x, agent.pos_y, agent.pos_z],
            "prompt_id": agent.prompt_id,
            "tools": agent.tools
        }

    def get_agents(self, db: Session):
        agents = agent_repository.get_all(db)
        return [self.format_response(a) for a in agents]

    def get_agent_by_id(self, db: Session, agent_id: str):
        agent = agent_repository.get_with_relations(db, agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        return self.format_response(agent)

    def create_agent(self, db: Session, data: AgentCreate):
        existing = agent_repository.get(db, data.id)
        if existing:
            raise HTTPException(status_code=400, detail="Agent ID already exists")
        
        payload = data.model_dump(exclude={"tool_ids"})
        agent = agent_repository.create(db, payload)
        
        if data.tool_ids:
            agent = agent_repository.update_agent_tools(db, agent, data.tool_ids)
            
        return self.format_response(agent)

    def update_agent(self, db: Session, agent_id: str, data: AgentUpdate):
        agent = agent_repository.get(db, agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
            
        update_data = data.model_dump(exclude_unset=True, exclude={"tool_ids"})
        tool_ids = data.tool_ids

        updated_agent = agent_repository.update(db, agent, update_data)
        if tool_ids is not None:
            updated_agent = agent_repository.update_agent_tools(db, updated_agent, tool_ids)

        return self.format_response(updated_agent)

    def delete_agent(self, db: Session, agent_id: str):
        success = agent_repository.delete(db, agent_id)
        if not success:
            raise HTTPException(status_code=404, detail="Agent not found")
        return {"success": True, "message": f"Agent {agent_id} deleted successfully"}

agent_service = AgentService()