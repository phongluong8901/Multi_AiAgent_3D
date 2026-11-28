"""
Module định tuyến REST API quản lý System Prompts (`/api/v1/prompts`).
Cho phép liệt kê, xem chi tiết, thêm mới, chỉnh sửa và xóa các chỉ thị hệ thống của Agent.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas.prompt_schema import PromptCreate, PromptUpdate
from app.services.prompt_service import prompt_service

router = APIRouter(prefix="/prompts", tags=["Prompts Management"])


@router.get("")
def list_prompts(db: Session = Depends(get_db)):
    """Lấy danh sách toàn bộ System Prompts trong hệ thống."""
    return prompt_service.get_prompts(db)


@router.get("/{prompt_id}")
def get_prompt(prompt_id: str, db: Session = Depends(get_db)):
    """Lấy chi tiết một System Prompt theo mã `prompt_id`."""
    return prompt_service.get_prompt(db, prompt_id)


@router.post("")
def create_prompt(data: PromptCreate, db: Session = Depends(get_db)):
    """Tạo mới một System Prompt."""
    return prompt_service.create_prompt(db, data)


@router.put("/{prompt_id}")
def update_prompt(prompt_id: str, data: PromptUpdate, db: Session = Depends(get_db)):
    """Cập nhật tiêu đề hoặc nội dung của một System Prompt."""
    return prompt_service.update_prompt(db, prompt_id, data)


@router.delete("/{prompt_id}")
def delete_prompt(prompt_id: str, db: Session = Depends(get_db)):
    """Xóa một System Prompt theo mã `prompt_id`."""
    return prompt_service.delete_prompt(db, prompt_id)
