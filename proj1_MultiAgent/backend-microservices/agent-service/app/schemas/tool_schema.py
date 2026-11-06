"""
Module dinh nghia cac Pydantic Schema cho thuc the Tool (`tool_schema.py`).
Quan ly viec dang ky, cap nhat va phan hoi cac cong cu ma Agent co the thuc thi.
"""

from pydantic import BaseModel
from typing import Optional


class ToolCreate(BaseModel):
    """
    Schema yeu cau dang ky Tool moi:
    - id: Dinh danh tool duy nhat (vi du: calculator, web_search, python_sandbox)
    - name: Ten goi de nho cua tool
    - description: Mo ta chuc nang de LLM hieu khi nao can kich hoat tool
    - code: Ma nguon Python cua tool (neu co)
    - parameters: JSON Schema dinh nghia tham so dau vao
    - category: Phan loai tool (system, custom, analysis, robotics)
    - env_vars: Bien moi truong can thiet
    """
    id: str
    name: str
    description: Optional[str] = None
    code: Optional[str] = None
    parameters: Optional[str] = None
    category: Optional[str] = "custom"
    env_vars: Optional[str] = None


class ToolUpdate(BaseModel):
    """
    Schema cap nhat noi dung hoac tham so cau hinh cua Tool.
    """
    name: Optional[str] = None
    description: Optional[str] = None
    code: Optional[str] = None
    parameters: Optional[str] = None
    category: Optional[str] = None
    env_vars: Optional[str] = None


class ToolResponse(ToolCreate):
    """
    Schema phan hoi thong tin Tool hoan chinh qua REST API.
    """
    model_config = {"from_attributes": True}
