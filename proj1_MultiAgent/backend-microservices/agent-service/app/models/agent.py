"""
Module dinh nghia SQLAlchemy ORM Model cho bang `agents` trong PostgreSQL.
Bieu dien thuc the Agent gom toa do 3D, avatar, LLM model mac dinh va quan he voi Tools, Prompts.
"""

from sqlalchemy import Column, String, Text, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base, agent_tools


class AgentModel(Base):
    """
    Model SQLAlchemy dai dien cho bang `agents`:
    - id: Khoa chinh, dinh danh duy nhat cua Agent
    - name: Ten cua Agent
    - color: Ma mau HEX cua Agent trong khong gian 3D
    - status: Trang thai hoat dong (idle, busy, offline)
    - speech: Cau thoai / loi chao hien tai
    - pos_x, pos_y, pos_z: Toa do khong gian 3D tren ban do
    - model: LLM engine duoc gan (Gemini, Ollama, DeepSeek, v.v.)
    - form: Hinh the 3D (humanoid, robot, drone)
    - body_id: ID khung the khop noi tu Agent Body Studio
    - prompt_id: Khoa ngoai lien ket voi bang prompts
    - tools: Quan he Many-to-Many voi bang tools thong qua bang trung gian agent_tools
    """
    __tablename__ = "agents"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    color = Column(String, default="#4299e1")
    status = Column(String, default="idle")
    speech = Column(Text, nullable=True)

    pos_x = Column(Float, default=0.0)
    pos_y = Column(Float, default=0.0)
    pos_z = Column(Float, default=0.0)

    model = Column(String, default="gemini-3.5-flash-lite")
    form = Column(String, default="humanoid")
    body_id = Column(String, nullable=True)

    prompt_id = Column(String, ForeignKey("prompts.id"), nullable=True)
    prompt = relationship("PromptModel", back_populates="agents")
    tools = relationship("ToolModel", secondary=agent_tools, back_populates="agents")
