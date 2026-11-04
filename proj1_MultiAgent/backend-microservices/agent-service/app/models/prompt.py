from sqlalchemy import Column, String, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class PromptModel(Base):
    __tablename__ = "prompts"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)

    agents = relationship("AgentModel", back_populates="prompt")