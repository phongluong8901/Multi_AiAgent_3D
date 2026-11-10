"""
Module định tuyến REST API quản lý vòng đời AI Agent (`/api/v1/agents`).
Hỗ trợ truy vấn danh sách, xem chi tiết, khởi tạo, cập nhật, xóa Agent và kích hoạt lại bộ Seeder mẫu.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas.agent_schema import AgentCreate, AgentUpdate
from app.services.agent_service import agent_service

router = APIRouter(prefix="/agents", tags=["Agents Management"])


@router.get("")
def list_agents(db: Session = Depends(get_db)):
    """Lấy danh sách toàn bộ AI Agent kèm cấu hình model, prompt và công cụ."""
    return agent_service.get_agents(db)


@router.get("/{agent_id}")
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    """Lấy thông tin chi tiết của một AI Agent theo mã định danh `agent_id`."""
    return agent_service.get_agent_by_id(db, agent_id)


@router.post("")
def create_agent(data: AgentCreate, db: Session = Depends(get_db)):
    """Tạo mới một AI Agent và gán danh sách công cụ (`tool_ids`)."""
    return agent_service.create_agent(db, data)


@router.put("/{agent_id}")
def update_agent(agent_id: str, data: AgentUpdate, db: Session = Depends(get_db)):
    """Cập nhật thông tin cấu hình, model, prompt hoặc danh sách công cụ của AI Agent."""
    return agent_service.update_agent(db, agent_id, data)


@router.delete("/{agent_id}")
def delete_agent(agent_id: str, db: Session = Depends(get_db)):
    """Xóa một AI Agent khỏi hệ thống."""
    return agent_service.delete_agent(db, agent_id)


@router.post("/seed/run")
def trigger_seed_agents(db: Session = Depends(get_db)):
    """Chạy lại seeder cho các Agent mẫu kèm Tools, Prompts và Models mặc định (`gemini-3.5-flash-lite`)."""
    from app.core.seeders import run_all_seeders

    run_all_seeders(db)
    return {
        "success": True,
        "message": "Đã seed và cập nhật thành công bộ Agent mẫu cùng Tools, Prompts và Models!",
        "agents": agent_service.get_agents(db),
    }
