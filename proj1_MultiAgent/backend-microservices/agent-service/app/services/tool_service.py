from sqlalchemy.orm import Session
from app.repositories.tool_repository import tool_repository
from app.schemas.tool_schema import ToolCreate, ToolUpdate
from fastapi import HTTPException

class ToolService:
    def get_tools(self, db: Session):
        return tool_repository.get_all(db)

    def get_tool(self, db: Session, tool_id: str):
        tool = tool_repository.get(db, tool_id)
        if not tool:
            raise HTTPException(status_code=404, detail="Tool not found")
        return tool

    def create_tool(self, db: Session, data: ToolCreate):
        existing = tool_repository.get(db, data.id)
        if existing:
            raise HTTPException(status_code=400, detail="Tool ID already exists")
        return tool_repository.create(db, data.model_dump())

    def update_tool(self, db: Session, tool_id: str, data: ToolUpdate):
        tool = tool_repository.get(db, tool_id)
        if not tool:
            raise HTTPException(status_code=404, detail="Tool not found")
        return tool_repository.update(db, tool, data.model_dump(exclude_unset=True))

    def delete_tool(self, db: Session, tool_id: str):
        success = tool_repository.delete(db, tool_id)
        if not success:
            raise HTTPException(status_code=404, detail="Tool not found")
        return {"success": True, "message": f"Tool {tool_id} deleted"}

tool_service = ToolService()