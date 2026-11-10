"""
Module dinh nghia SQLAlchemy ORM Model cho bang `tools` trong PostgreSQL.
Bieu dien cac cong cu / ham thuc thi ma Agent co the goi thong qua Function Calling.
"""

from sqlalchemy import Column, String, Text
from sqlalchemy.orm import relationship
from app.models.base import Base, agent_tools


class ToolModel(Base):
    """
    Model SQLAlchemy dai dien cho bang `tools`:
    - id: Khoa chinh, ma dinh danh cua cong cu (vi du: calculator, web_search)
    - name: Ten cong cu
    - description: Mo ta chuc nang cong cu danh cho LLM phan tich
    - code: Ma nguon Python (neu cong cu duoc sinh dong)
    - parameters: JSON Schema mo ta cac doi so dau vao
    - category: Nhom cong cu (custom, analysis, system, robotics)
    - env_vars: Bien moi truong can thiet khi chay cong cu
    - agents: Quan he Many-to-Many voi AgentModel qua bang trung gian agent_tools
    """
    __tablename__ = "tools"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    code = Column(Text, nullable=True)
    parameters = Column(Text, nullable=True)
    category = Column(String, default="custom", nullable=True)
    env_vars = Column(Text, nullable=True)

    agents = relationship("AgentModel", secondary=agent_tools, back_populates="tools")
