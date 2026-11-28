from sqlalchemy.orm import Session
from app.repositories.tool_repository import tool_repository
from app.schemas.tool_schema import ToolCreate, ToolUpdate
from fastapi import HTTPException


class ToolService:
    """
    Dịch vụ quản lý danh mục Công cụ (`Tools`) mà các AI Agent có thể sử dụng.
    Hỗ trợ quản lý cả công cụ tích hợp sẵn (`builtin`), công cụ gọi API ngoài (`api`)
    và công cụ tùy chỉnh do người dùng hoặc Agent Lab tự sinh (`custom` / `generated`).
    """

    def get_tools(self, db: Session):
        """Lấy toàn bộ danh sách công cụ đã đăng ký trong hệ thống."""
        return tool_repository.get_all(db)

    def get_tool(self, db: Session, tool_id: str):
        """Lấy thông tin chi tiết của một công cụ theo `tool_id`."""
        tool = tool_repository.get(db, tool_id)
        if not tool:
            raise HTTPException(status_code=404, detail="Tool not found")
        return tool

    def create_tool(self, db: Session, data: ToolCreate):
        """Đăng ký một công cụ mới vào cơ sở dữ liệu."""
        existing = tool_repository.get(db, data.id)
        if existing:
            raise HTTPException(status_code=400, detail="Tool ID already exists")
        return tool_repository.create(db, data.model_dump())

    def update_tool(self, db: Session, tool_id: str, data: ToolUpdate):
        """Cập nhật thông tin mô tả, mã nguồn Python, tham số JSON Schema hoặc biến môi trường của công cụ."""
        tool = tool_repository.get(db, tool_id)
        if not tool:
            raise HTTPException(status_code=404, detail="Tool not found")
        return tool_repository.update(db, tool, data.model_dump(exclude_unset=True))

    def delete_tool(self, db: Session, tool_id: str):
        """Xóa một công cụ khỏi cơ sở dữ liệu."""
        success = tool_repository.delete(db, tool_id)
        if not success:
            raise HTTPException(status_code=404, detail="Tool not found")
        return {"success": True, "message": f"Tool {tool_id} deleted"}


tool_service = ToolService()
