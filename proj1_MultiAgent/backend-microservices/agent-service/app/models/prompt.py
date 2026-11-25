"""
Module dinh nghia SQLAlchemy ORM Model cho bang `prompts` trong PostgreSQL.
Chuyen quan ly noi dung Persona va System Prompts cho toan bo Agent.
"""

from sqlalchemy import Column, String, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class PromptModel(Base):
    """
    Model SQLAlchemy dai dien cho bang `prompts`:
    - id: Khoa chinh, dinh danh prompt (vi du: prompt_manager, prompt_coder)
    - title: Tieu de cua System Prompt
    - content: Noi dung huong dan goc truyen cho LLM khi bat dau phien hoi thoai
    - agents: Quan he One-to-Many voi AgentModel
    """
    __tablename__ = "prompts"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)

    agents = relationship("AgentModel", back_populates="prompt")
