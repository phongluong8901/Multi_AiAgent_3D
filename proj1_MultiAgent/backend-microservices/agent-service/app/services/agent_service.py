from sqlalchemy.orm import Session
from app.repositories.agent_repository import agent_repository
from app.schemas.agent_schema import AgentCreate, AgentUpdate, AgentResponse
from fastapi import HTTPException

class AgentService:
    """
    Dịch vụ nghiệp vụ quản lý vòng đời của AI Agent (`AgentService`).
    Cung cấp các phương thức CRUD (Liệt kê, Chi tiết, Tạo mới, Cập nhật, Xóa)
    và chuẩn hóa cấu trúc phản hồi (bao gồm vị trí 3D, model mặc định, prompt và danh sách công cụ).
    """

    @staticmethod
    def format_response(agent) -> dict:
        """Chuẩn hóa đối tượng SQLAlchemy `AgentModel` sang dict trả về qua REST API."""
        return {
            "id": agent.id,
            "name": agent.name,
            "color": agent.color,
            "status": agent.status,
            "speech": agent.speech,
            "position": [agent.pos_x, agent.pos_y, agent.pos_z],
            "model": getattr(agent, "model", None) or "gemini-3.5-flash-lite",
            "form": getattr(agent, "form", None) or "humanoid",
            "body_id": getattr(agent, "body_id", None),
            "prompt_id": agent.prompt_id,
            "tools": agent.tools
        }

    def get_agents(self, db: Session):
        """Lấy toàn bộ danh sách Agent đã đăng ký trong cơ sở dữ liệu."""
        agents = agent_repository.get_all(db)
        return [self.format_response(a) for a in agents]

    def get_agent_by_id(self, db: Session, agent_id: str):
        """Truy vấn thông tin chi tiết của một Agent theo ID kèm quan hệ `tools` và `prompt`."""
        agent = agent_repository.get_with_relations(db, agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        return self.format_response(agent)

    def create_agent(self, db: Session, data: AgentCreate):
        """Khởi tạo một Agent mới và liên kết danh sách công cụ (`tool_ids`) tương ứng."""
        existing = agent_repository.get(db, data.id)
        if existing:
            raise HTTPException(status_code=400, detail="Agent ID already exists")
        
        payload = data.model_dump(exclude={"tool_ids"})
        agent = agent_repository.create(db, payload)
        
        if data.tool_ids:
            agent = agent_repository.update_agent_tools(db, agent, data.tool_ids)
            
        return self.format_response(agent)

    def update_agent(self, db: Session, agent_id: str, data: AgentUpdate):
        """Cập nhật thông tin cấu hình, model, prompt hoặc danh sách công cụ của Agent."""
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
        """Xóa một Agent khỏi hệ thống theo ID."""
        success = agent_repository.delete(db, agent_id)
        if not success:
            raise HTTPException(status_code=404, detail="Agent not found")
        return {"success": True, "message": f"Agent {agent_id} deleted successfully"}

agent_service = AgentService()
