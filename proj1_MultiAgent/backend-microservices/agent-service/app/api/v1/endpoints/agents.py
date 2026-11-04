from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas.agent_schema import AgentCreate, AgentUpdate
from app.services.agent_service import agent_service

router = APIRouter(prefix="/agents", tags=["Agents Management"])

@router.get("")
def list_agents(db: Session = Depends(get_db)):
    return agent_service.get_agents(db)

@router.get("/{agent_id}")
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    return agent_service.get_agent_by_id(db, agent_id)

@router.post("")
def create_agent(data: AgentCreate, db: Session = Depends(get_db)):
    return agent_service.create_agent(db, data)

@router.put("/{agent_id}")
def update_agent(agent_id: str, data: AgentUpdate, db: Session = Depends(get_db)):
    return agent_service.update_agent(db, agent_id, data)

@router.delete("/{agent_id}")
def delete_agent(agent_id: str, db: Session = Depends(get_db)):
    return agent_service.delete_agent(db, agent_id)

@router.post("/seed/run")
def trigger_seed_agents(db: Session = Depends(get_db)):
    """Chạy lại seeder cho 6 Agent mẫu (Manager, Search, Summary, Calculate, Analysis, ML) kèm tools, prompt, model."""
    from app.core.seeders import run_all_seeders
    run_all_seeders(db)
    return {
        "success": True,
        "message": "Đã seed và cập nhật thành công 6 nhóm Agent mẫu cùng Tools, Prompts và Models!",
        "agents": agent_service.get_agents(db)
    }