from pydantic import BaseModel
from typing import Optional

class PromptCreate(BaseModel):
    id: str
    title: str
    content: str

class PromptUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class PromptResponse(PromptCreate):
    model_config = {"from_attributes": True}