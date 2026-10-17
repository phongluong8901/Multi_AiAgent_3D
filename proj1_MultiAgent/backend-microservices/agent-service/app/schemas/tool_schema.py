from pydantic import BaseModel
from typing import Optional

class ToolCreate(BaseModel):
    id: str
    name: str
    description: Optional[str] = None

class ToolUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ToolResponse(ToolCreate):
    model_config = {"from_attributes": True}