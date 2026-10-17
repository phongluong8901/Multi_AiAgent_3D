from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas.tool_schema import ToolCreate, ToolUpdate
from app.services.tool_service import tool_service

router = APIRouter(prefix="/tools", tags=["Tools Management"])

@router.get("")
def list_tools(db: Session = Depends(get_db)):
    return tool_service.get_tools(db)

@router.post("")
def create_tool(data: ToolCreate, db: Session = Depends(get_db)):
    return tool_service.create_tool(db, data)

@router.put("/{tool_id}")
def update_tool(tool_id: str, data: ToolUpdate, db: Session = Depends(get_db)):
    return tool_service.update_tool(db, tool_id, data)

@router.delete("/{tool_id}")
def delete_tool(tool_id: str, db: Session = Depends(get_db)):
    return tool_service.delete_tool(db, tool_id)