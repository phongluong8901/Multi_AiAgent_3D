from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel

from app.api.deps import get_db
from app.services.tool_service import tool_service
from app.services.tool_executor import tool_executor

router = APIRouter(prefix="/tools", tags=["Tool Execution"])

class ToolExecuteRequest(BaseModel):
    tool_id: Optional[str] = None
    code: Optional[str] = None
    arguments: Optional[Dict[str, Any]] = {}
    env_vars: Optional[Any] = None

@router.post("/execute")
def execute_tool_endpoint(payload: ToolExecuteRequest, db: Session = Depends(get_db)):
    """
    Endpoint kiểm tra (test) việc thực thi logic của một tool bất kỳ hoặc chạy thử code Python trực tiếp từ UI.
    """
    # 1. Nếu có gửi kèm mã code (test trực tiếp từ Code Editor trên Web)
    if payload.code and payload.code.strip():
        result = tool_executor.execute_custom_code(payload.code, payload.arguments or {}, env_vars=payload.env_vars)
        return {
            "tool_id": payload.tool_id or "custom_code_test",
            "execution_result": result
        }

    if not payload.tool_id:
        return {"success": False, "error": "Cần cung cấp tool_id hoặc code để thực thi."}

    # 2. Tìm kiếm trong database
    tool_obj = None
    try:
        tool_obj = tool_service.get_tool(db, payload.tool_id)
    except Exception:
        pass

    # 3. Thực thi qua executor (hỗ trợ custom code trong DB hoặc registry built-in)
    result = tool_executor.execute(payload.tool_id, payload.arguments or {}, tool_obj=tool_obj)
    return {
        "tool_id": payload.tool_id,
        "execution_result": result
    }