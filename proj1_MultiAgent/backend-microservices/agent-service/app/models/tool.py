from sqlalchemy import Column, String, Text
from sqlalchemy.orm import relationship
from app.models.base import Base, agent_tools

class ToolModel(Base):
    __tablename__ = "tools"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    code = Column(Text, nullable=True)
    parameters = Column(Text, nullable=True)
    category = Column(String, default="custom", nullable=True)
    env_vars = Column(Text, nullable=True)

    agents = relationship("AgentModel", secondary=agent_tools, back_populates="tools")