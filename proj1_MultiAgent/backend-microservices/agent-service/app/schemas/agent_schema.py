"""
Module dinh nghia cac Pydantic Schema cho thuc the AI Agent (`agent_schema.py`).
Bao gom cac mo hinh xac thuc du lieu dau vao cho cac thao tac tao moi, cap nhat va phan hoi API.
"""

from pydantic import BaseModel
from typing import List, Optional
from app.schemas.tool_schema import ToolResponse


class AgentCreate(BaseModel):
    """
    Schema yeu cau khoi tao mot AI Agent moi trong he thong:
    - id: Dinh danh duy nhat cua Agent (vi du: agent_manager, agent_coder)
    - name: Ten hien thi cua Agent
    - color: Ma mau giao dien HSL/HEX
    - status: Trang thai ban dau (idle, active, busy)
    - model: LLM mac dinh su dung (vi du: gemini-3.5-flash-lite, ollama)
    - form: Hinh thai 3D cua Agent (humanoid, duck, drone, amr)
    - tool_ids: Danh sach ID cac cong cu duoc phep thuc thi
    """
    id: str
    name: str
    color: Optional[str] = "#4299e1"
    status: Optional[str] = "idle"
    speech: Optional[str] = None
    pos_x: Optional[float] = 0.0
    pos_y: Optional[float] = 0.0
    pos_z: Optional[float] = 0.0
    model: Optional[str] = "gemini-3.5-flash-lite"
    form: Optional[str] = "humanoid"
    body_id: Optional[str] = None
    prompt_id: Optional[str] = None
    tool_ids: Optional[List[str]] = []


class AgentUpdate(BaseModel):
    """
    Schema cap nhat thong tin Agent:
    Cac truong deu la tuy chon (Optional), chi cap nhat nhung truong duoc truyen len.
    """
    name: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None
    speech: Optional[str] = None
    pos_x: Optional[float] = None
    pos_y: Optional[float] = None
    pos_z: Optional[float] = None
    model: Optional[str] = None
    form: Optional[str] = None
    body_id: Optional[str] = None
    prompt_id: Optional[str] = None
    tool_ids: Optional[List[str]] = None


class AgentResponse(BaseModel):
    """
    Schema phan hoi thong tin chi tiet cua mot AI Agent qua REST API:
    Bao gom toa do khong gian 3D, he thong tool da nap va cau hinh mo hinh.
    """
    id: str
    name: str
    color: str
    status: str
    speech: Optional[str] = None
    position: List[float]
    model: Optional[str] = "gemini-3.5-flash-lite"
    form: Optional[str] = "humanoid"
    body_id: Optional[str] = None
    prompt_id: Optional[str] = None
    tools: List[ToolResponse] = []

    model_config = {"from_attributes": True}
