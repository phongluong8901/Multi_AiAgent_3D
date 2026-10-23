from pydantic import BaseModel
from typing import List, Optional
from app.schemas.tool_schema import ToolResponse

class AgentCreate(BaseModel):
    id: str
    name: str
    color: Optional[str] = "#4299e1"
    status: Optional[str] = "idle"
    speech: Optional[str] = None
    pos_x: Optional[float] = 0.0
    pos_y: Optional[float] = 0.0
    pos_z: Optional[float] = 0.0
    model: Optional[str] = "gemini-2.5-flash-lite"
    prompt_id: Optional[str] = None
    tool_ids: Optional[List[str]] = []

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None
    speech: Optional[str] = None
    pos_x: Optional[float] = None
    pos_y: Optional[float] = None
    pos_z: Optional[float] = None
    model: Optional[str] = None
    prompt_id: Optional[str] = None
    tool_ids: Optional[List[str]] = None

class AgentResponse(BaseModel):
    id: str
    name: str
    color: str
    status: str
    speech: Optional[str] = None
    position: List[float]
    model: Optional[str] = "gemini-2.5-flash-lite"
    prompt_id: Optional[str] = None
    tools: List[ToolResponse] = []

    model_config = {"from_attributes": True}