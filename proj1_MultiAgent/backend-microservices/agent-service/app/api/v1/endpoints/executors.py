from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
import time
import json

from app.api.deps import get_db
from app.services.tool_service import tool_service
from app.services.tool_executor import tool_executor
from app.core.tools.registry import tool_registry

router = APIRouter(prefix="/tools", tags=["Tool Execution"])

# Danh sách tham số mẫu an toàn và chuẩn cho từng loại tool hệ thống
DEFAULT_TOOL_SAMPLE_ARGS: Dict[str, Dict[str, Any]] = {
    "calculator_tool": {"expression": "25 * 4 + 10"},
    "scientific_calculator": {"expression": "sqrt(144) + 10"},
    "web_search_tool": {"query": "LangGraph multi-agent architecture"},
    "google_search_tool": {"query": "LangGraph multi-agent architecture"},
    "wikipedia_tool": {"query": "Artificial Intelligence"},
    "web_crawler_tool": {"url": "https://example.com"},
    "data_visualization_tool": {"data": [10, 25, 45, 30], "type": "bar", "title": "Bieu do thu nghiem"},
    "pdf_analyzer_tool": {"text": "Tai lieu thu nghiem trich xuat thong tin tong quan."},
    "financial_market_tool": {"operation": "cagr", "initial_value": 1000, "final_value": 2000, "periods": 3},
    "data_analysis_tool": {"numbers": [10, 20, 30, 40, 50]},
    "csv_analyzer_tool": {"csv_content": "id,name,role\n1,Alpha,Worker\n2,Beta,Supervisor"},
    "json_data_transformer_tool": {"json_str": '{"status": "ok", "service": "agent-service"}'},
    "sentiment_analysis_tool": {"text": "He thong hoat dong rat muot ma va on dinh!"},
    "sentiment_tool": {"text": "He thong hoat dong rat muot ma va on dinh!"},
    "summarizer_tool": {"text": "He thong Multi-Agent phan tan ket hop microservices giup xu ly cac tac vu tu dong hoa hieu qua cao.", "max_length": 60},
    "text_summarizer_tool": {"text": "He thong Multi-Agent phan tan ket hop microservices giup xu ly cac tac vu tu dong hoa hieu qua cao.", "max_length": 60},
    "text_summarizer": {"text": "He thong Multi-Agent phan tan ket hop microservices giup xu ly cac tac vu tu dong hoa hieu qua cao.", "max_length": 60},
    "workflow_planner_tool": {"task": "Lap ke hoach phan tich du lieu tu dong va xuat bao cao"},
    "system_health_tool": {},
    "system_control_tool": {},
    "python_code_generator_tool": {"prompt": "Ham tinh tong hai so nguyen a va b"},
    "python_sandbox_tool": {"code": "result = 12 * 8\nprint(f'Ket qua: {result}')"},
    "sql_query_generator_tool": {"prompt": "Lay danh sach nguoi dung dang ky trong thang 11"},
    "security_code_auditor_tool": {"code": "def run_query(param):\n    return eval(param)"},
    "ml_evaluator_tool": {"y_true": [1, 0, 1, 1], "y_pred": [1, 0, 1, 0]},
    "image_analyzer_tool": {"task": "info", "image_url": "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800"},
}

def parse_execution_result(result_raw: Any) -> tuple[bool, Optional[str], Any]:
    """
    Phân tích kết quả trả về từ tool_executor để xác định:
    - success (bool): Tool có thực thi thành công không
    - error (str | None): Chi tiết lỗi nếu có
    - parsed_data (Any): Dữ liệu sau khi parse json hoặc format
    """
    if result_raw is None:
        return False, "Tool không trả về kết quả (None).", None

    parsed = result_raw
    if isinstance(result_raw, str):
        try:
            parsed = json.loads(result_raw)
        except Exception:
            parsed = result_raw

    if isinstance(parsed, dict):
        if parsed.get("success") is False:
            err = parsed.get("error") or "Lỗi thực thi tool"
            return False, str(err), parsed
        if "error" in parsed and parsed.get("error") and parsed.get("success") is not True:
            return False, str(parsed.get("error")), parsed
        return True, None, parsed
    elif isinstance(parsed, str):
        lower = parsed.lower()
        if "not found in registry" in lower:
            return False, f"Tool chưa được đăng ký trong hệ thống: {parsed}", parsed
        if parsed.strip().startswith("Lỗi") or "traceback" in lower:
            return False, parsed, parsed
        return True, None, parsed

    return True, None, parsed


class ToolExecuteRequest(BaseModel):
    tool_id: Optional[str] = None
    code: Optional[str] = None
    arguments: Optional[Dict[str, Any]] = {}
    env_vars: Optional[Any] = None


class ToolTestRequest(BaseModel):
    arguments: Optional[Dict[str, Any]] = None


@router.post("/execute")
def execute_tool_endpoint(payload: ToolExecuteRequest, db: Session = Depends(get_db)):
    """
    Endpoint thực thi hoặc test logic của một tool bất kỳ, hoặc chạy code Python trực tiếp.
    Trả về chi tiết thời gian phản hồi (latency_ms), cờ success và parsed_result.
    """
    start_time = time.perf_counter()

    # 1. Nếu có gửi kèm mã code (test trực tiếp từ Code Editor trên Web)
    if payload.code and payload.code.strip():
        result = tool_executor.execute_custom_code(payload.code, payload.arguments or {}, env_vars=payload.env_vars)
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        success, error_msg, parsed_res = parse_execution_result(result)
        return {
            "tool_id": payload.tool_id or "custom_code_test",
            "success": success,
            "status": "healthy" if success else "error",
            "latency_ms": duration_ms,
            "error": error_msg,
            "execution_result": result,
            "parsed_result": parsed_res,
        }

    if not payload.tool_id:
        return {
            "tool_id": "unknown",
            "success": False,
            "status": "error",
            "latency_ms": 0,
            "error": "Cần cung cấp tool_id hoặc code để thực thi.",
            "execution_result": None,
        }

    # 2. Tìm kiếm trong database
    tool_obj = None
    try:
        tool_obj = tool_service.get_tool(db, payload.tool_id)
    except Exception:
        pass

    # 3. Thực thi qua executor (hỗ trợ custom code trong DB hoặc registry built-in)
    try:
        result = tool_executor.execute(payload.tool_id, payload.arguments or {}, tool_obj=tool_obj)
    except Exception as exc:
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "tool_id": payload.tool_id,
            "success": False,
            "status": "error",
            "latency_ms": duration_ms,
            "error": str(exc),
            "execution_result": None,
        }

    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
    success, error_msg, parsed_res = parse_execution_result(result)

    return {
        "tool_id": payload.tool_id,
        "success": success,
        "status": "healthy" if success else "error",
        "latency_ms": duration_ms,
        "error": error_msg,
        "execution_result": result,
        "parsed_result": parsed_res,
    }


@router.post("/test-all")
def test_all_tools_endpoint(db: Session = Depends(get_db)):
    """
    Kiểm tra hàng loạt (health check) tất cả các tools trong hệ thống với các tham số mẫu an toàn.
    Cho biết chính xác tool nào hoạt động tốt, tool nào bị lỗi hoặc thiếu cấu hình.
    """
    # 1. Thu thập tools từ Database
    db_tools: Dict[str, Any] = {}
    try:
        items = tool_service.get_tools(db)
        for it in items:
            tid_val = str(getattr(it, "id", "") or "")
            if tid_val:
                db_tools[tid_val] = it
    except Exception as e:
        print(f"[WARN] [test-all] Lỗi đọc tools từ DB: {e}")

    # 2. Thu thập tools từ Built-in Registry
    registry_tool_ids: List[str] = [str(x) for x in tool_registry.list_tools()]

    # Hợp nhất tất cả tool_ids thành list string thuần túy
    all_tool_ids: List[str] = list(dict.fromkeys(list(db_tools.keys()) + registry_tool_ids))

    results: List[Dict[str, Any]] = []
    healthy_count = 0
    error_count = 0

    for tid in all_tool_ids:
        db_obj = db_tools.get(tid)
        name_val = getattr(db_obj, "name", None) if db_obj else None
        name = str(name_val) if name_val is not None else tid.replace("_", " ").title()

        category_val = getattr(db_obj, "category", None) if db_obj else None
        category = str(category_val) if category_val is not None else "general"

        is_custom = bool(db_obj and getattr(db_obj, "code", None))

        # Xác định sample arguments phù hợp
        sample_args: Dict[str, Any] = {}
        raw_params = getattr(db_obj, "parameters", None) if db_obj else None
        if raw_params:
            try:
                parsed_params = json.loads(str(raw_params))
                if isinstance(parsed_params, dict) and parsed_params:
                    sample_args = parsed_params
            except Exception:
                pass

        if not sample_args:
            sample_args = DEFAULT_TOOL_SAMPLE_ARGS.get(tid, {})

        # Tiến hành kiểm tra gọi tool
        start_time = time.perf_counter()
        try:
            res_raw = tool_executor.execute(tid, sample_args, tool_obj=db_obj)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            success, error_msg, parsed_data = parse_execution_result(res_raw)
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            success = False
            error_msg = str(exc)
            parsed_data = None
            res_raw = str(exc)

        if success:
            healthy_count += 1
        else:
            error_count += 1

        # Tạo chuỗi preview tóm tắt ngắn gọn
        preview_text = ""
        if isinstance(parsed_data, dict):
            preview_keys = [k for k in parsed_data.keys() if k not in ["success"]]
            preview_text = ", ".join(f"{k}: {str(parsed_data[k])[:40]}" for k in preview_keys[:3])
        elif isinstance(res_raw, str):
            preview_text = str(res_raw)[:120]

        results.append({
            "id": tid,
            "name": name,
            "category": category,
            "is_custom": is_custom,
            "success": success,
            "status": "healthy" if success else "error",
            "latency_ms": duration_ms,
            "sample_args": sample_args,
            "error": error_msg,
            "preview": preview_text,
        })

    return {
        "total": len(all_tool_ids),
        "healthy_count": healthy_count,
        "error_count": error_count,
        "results": results,
    }


@router.post("/{tool_id}/test")
def test_single_tool_endpoint(
    tool_id: str,
    payload: Optional[ToolTestRequest] = None,
    db: Session = Depends(get_db)
):
    """
    Kiểm tra chi tiết một tool theo ID với tham số truyền vào tùy chọn hoặc tham số mẫu.
    """
    start_time = time.perf_counter()

    tool_obj = None
    try:
        tool_obj = tool_service.get_tool(db, tool_id)
    except Exception:
        pass

    # Xác định arguments để test
    args: Dict[str, Any] = {}
    if payload and payload.arguments is not None:
        args = payload.arguments
    elif tool_obj and getattr(tool_obj, "parameters", None):
        try:
            raw_params = str(getattr(tool_obj, "parameters", "") or "")
            parsed = json.loads(raw_params)
            if isinstance(parsed, dict):
                args = parsed
        except Exception:
            args = DEFAULT_TOOL_SAMPLE_ARGS.get(tool_id, {})
    else:
        args = DEFAULT_TOOL_SAMPLE_ARGS.get(tool_id, {})

    tool_name_val = getattr(tool_obj, "name", None) if tool_obj else None
    tool_name = str(tool_name_val) if tool_name_val is not None else tool_id

    try:
        result = tool_executor.execute(tool_id, args, tool_obj=tool_obj)
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        success, error_msg, parsed_res = parse_execution_result(result)
    except Exception as exc:
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "tool_id": tool_id,
            "tool_name": tool_name,
            "success": False,
            "status": "error",
            "latency_ms": duration_ms,
            "arguments_used": args,
            "error": str(exc),
            "execution_result": None,
            "parsed_result": None,
        }

    return {
        "tool_id": tool_id,
        "tool_name": tool_name,
        "success": success,
        "status": "healthy" if success else "error",
        "latency_ms": duration_ms,
        "arguments_used": args,
        "error": error_msg,
        "execution_result": result,
        "parsed_result": parsed_res,
    }
