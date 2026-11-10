"""
Module định tuyến REST API quản lý danh mục Công cụ (`/api/v1/tools`).
Hỗ trợ quản lý cả công cụ tích hợp sẵn (`builtin`), công cụ gọi API ngoài (`api`) và công cụ tùy chỉnh (`custom`).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas.tool_schema import ToolCreate, ToolUpdate
from app.services.tool_service import tool_service

router = APIRouter(prefix="/tools", tags=["Tools Management"])


@router.get("")
def list_tools(db: Session = Depends(get_db)):
    """Lấy danh sách toàn bộ công cụ đã đăng ký trong hệ thống."""
    return tool_service.get_tools(db)


@router.get("/{tool_id}")
def get_tool(tool_id: str, db: Session = Depends(get_db)):
    """Lấy thông tin chi tiết của một công cụ theo `tool_id`."""
    return tool_service.get_tool(db, tool_id)


@router.post("")
def create_tool(data: ToolCreate, db: Session = Depends(get_db)):
    """Đăng ký mới một công cụ vào hệ thống."""
    return tool_service.create_tool(db, data)


@router.put("/{tool_id}")
def update_tool(tool_id: str, data: ToolUpdate, db: Session = Depends(get_db)):
    """Cập nhật mô tả, mã nguồn Python, tham số hoặc biến môi trường (`env_vars`) của công cụ."""
    return tool_service.update_tool(db, tool_id, data)


@router.delete("/{tool_id}")
def delete_tool(tool_id: str, db: Session = Depends(get_db)):
    """Xóa một công cụ khỏi cơ sở dữ liệu."""
    return tool_service.delete_tool(db, tool_id)
