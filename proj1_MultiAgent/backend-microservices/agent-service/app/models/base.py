from sqlalchemy.orm import declarative_base
from sqlalchemy import Table, Column, String, ForeignKey

Base = declarative_base()

# Định nghĩa bảng trung gian chung ở đây để tránh circular import
agent_tools = Table(
    "agent_tools",
    Base.metadata,
    Column("agent_id", String, ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True),
    Column("tool_id", String, ForeignKey("tools.id", ondelete="CASCADE"), primary_key=True),
)