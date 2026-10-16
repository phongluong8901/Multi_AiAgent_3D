from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel

from app.api.deps import get_db
from app.services.tool_service import tool_service
from app.services.tool_executor import tool_executor

router = APIRouter(prefix="/tools", tags=["Tool Execution"])

class ToolExecuteRequest(BaseModel):
    tool_id: str
    arguments: Optional[Dict[str, Any]] = {}

@router.post("/execute")
def execute_tool_endpoint(payload: ToolExecuteRequest, db: Session = Depends(get_db)):
    """
    Endpoint kiểm tra (test) việc thực thi logic của một tool bất kỳ.
    """
    tool = tool_service.get_tool(db, payload.tool_id)
    if not tool:
        return {"success": False, "error": f"Tool '{payload.tool_id}' not found in database."}

    result = tool_executor.execute(payload.tool_id, payload.arguments)
    return {
        "tool_id": payload.tool_id,
        "execution_result": result
    }