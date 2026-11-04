from sqlalchemy import Column, String, Text, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base, agent_tools

class AgentModel(Base):
    __tablename__ = "agents"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    color = Column(String, default="#4299e1")
    status = Column(String, default="idle")
    speech = Column(Text, nullable=True)
    
    pos_x = Column(Float, default=0.0)
    pos_y = Column(Float, default=0.0)
    pos_z = Column(Float, default=0.0)

    model = Column(String, default="gemini-2.5-flash-lite")
    form = Column(String, default="humanoid")
    body_id = Column(String, nullable=True)

    prompt_id = Column(String, ForeignKey("prompts.id"), nullable=True)
    prompt = relationship("PromptModel", back_populates="agents")
    tools = relationship("ToolModel", secondary=agent_tools, back_populates="agents")
