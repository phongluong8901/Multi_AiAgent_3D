"""
Module dinh nghia cac Pydantic Schema cho System Prompt (`prompt_schema.py`).
Quan ly viec thiet lap va cap nhat chi thi he thong (Persona / Instructions) cho cac Agent.
"""

from pydantic import BaseModel
from typing import Optional


class PromptCreate(BaseModel):
    """
    Schema khoi tao System Prompt moi:
    - id: Dinh danh prompt (vi du: prompt_manager, prompt_coder)
    - title: Tieu de goi nho cua prompt
    - content: Noi dung huong dan chi tiet danh cho Agent
    """
    id: str
    title: str
    content: str


class PromptUpdate(BaseModel):
    """
    Schema cap nhat noi dung hoac tieu de cua System Prompt.
    """
    title: Optional[str] = None
    content: Optional[str] = None


class PromptResponse(PromptCreate):
    """
    Schema phan hoi thong tin Prompt qua REST API.
    """
    model_config = {"from_attributes": True}
