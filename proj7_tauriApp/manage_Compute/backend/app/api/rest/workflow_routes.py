"""
Router REST API Quản lý Workflow & Đồ thị Tự động hóa:
Cung cấp các API để bật/tắt Auto-Guard, chạy thử nghiệm đồ thị (run-once),
triển khai giám sát nền liên tục, xem nhật ký kiểm toán sự cố và xuất báo cáo CSV/JSON.
"""

from fastapi import APIRouter, Response, Query
from pydantic import BaseModel
from typing import Optional, Any
from app.schemas.workflow_schema import WorkflowGraphRequest
from app.modules.workflow_engine.dag_runner import dag_runner
from app.modules.workflow_engine.actions import execute_node_action
from app.modules.workflow_engine.incident_manager import incident_manager
from app.modules.workflow_engine.notifier import dispatch_notification

router = APIRouter(prefix="/workflows", tags=["Workflow Engine"])

class GuardToggleRequest(BaseModel):
    """Schema yêu cầu bật / tắt chế độ Auto-Guard."""
    armed: Optional[bool] = None

class ActionTestRequest(BaseModel):
    """Schema yêu cầu chạy thử nghiệm đơn lẻ một hành động của node."""
    action_type: str
    search_query: Optional[str] = None
    folder_path: Optional[str] = None
    command: Optional[str] = None
    pid: Optional[int] = None
    metric: Optional[str] = None
    proc_name: Optional[str] = None
    platform: Optional[str] = "discord"
    webhook_url: Optional[str] = None
    telegram_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    message_template: Optional[str] = None

@router.get("/guard/status")
def get_guard_status():
    """
    Truy vấn trạng thái hoạt động hiện tại của Auto-Guard (vũ trang, số lần can thiệp, lịch trình).
    """
    return dag_runner.get_guard_status()

@router.post("/guard/toggle")
def toggle_guard(req: GuardToggleRequest = GuardToggleRequest()):
    """
    Bật hoặc tắt trạng thái vũ trang (Armed) của Auto-Guard.
    """
    new_state = dag_runner.toggle_guard(req.armed)
    return {"guard_armed": new_state, "status": "updated"}

@router.post("/action/test")
def test_workflow_action(req: ActionTestRequest):
    """
    Chạy thử nghiệm một hành động can thiệp (Action) ở chế độ kiểm thử mà không làm gián đoạn hệ thống.
    """
    data = req.model_dump()
    data["is_test"] = True
    res = execute_node_action(data)
    return {"status": "ok", "action": req.action_type, "result": res}

@router.post("/run-once")
def run_workflow_once(graph: WorkflowGraphRequest):
    """
    Thực thi toàn bộ đồ thị DAG workflow một lần duy nhất và trả về vết chạy (trace log).
    """
    events = dag_runner.execute_once(graph)
    return {
        "workflow_id": graph.workflow_id,
        "triggered_events": events,
        "interventions_count": dag_runner.interventions_count,
        "execution_trace": dag_runner.last_execution_trace,
    }

@router.post("/deploy")
async def deploy_continuous_workflow(graph: WorkflowGraphRequest):
    """
    Triển khai workflow thành một tác vụ chạy nền định kỳ để liên tục giám sát và tự động can thiệp.
    """
    return dag_runner.start_background_workflow(graph)

@router.post("/{workflow_id}/stop")
async def stop_workflow(workflow_id: str):
    """
    Dừng một workflow đang chạy nền theo mã workflow_id.
    """
    return dag_runner.stop_background_workflow(workflow_id)

@router.get("/logs")
def get_workflow_logs():
    """
    Lấy danh sách các workflow đang chạy và 50 nhật ký thực thi gần nhất.
    """
    return {
        "active_workflows": list(dag_runner.active_tasks.keys()),
        "guard_status": dag_runner.get_guard_status(),
        "logs": dag_runner.execution_logs[-50:]
    }

@router.get("/incidents")
def get_incidents(
    limit: int = Query(50, description="Số lượng sự cố tối đa"),
    severity: Optional[str] = Query(None, description="Bộ lọc mức độ nghiêm trọng")
):
    """
    Truy vấn lịch sử các sự cố vi phạm tài nguyên đã được ghi nhận.
    """
    return {
        "incidents": incident_manager.get_incidents(limit=limit, severity=severity),
        "total_recorded": len(incident_manager.incidents)
    }

@router.get("/incidents/export")
def export_incidents(format: str = Query("csv", pattern="^(csv|json)$", description="Định dạng xuất: csv hoặc json")):
    """
    Xuất danh sách sự cố phục vụ báo cáo kiểm toán dưới định dạng file CSV tải về hoặc JSON.
    """
    if format == "json":
        return incident_manager.export_json()
    csv_data = incident_manager.export_csv()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=incident-audit-log.csv"}
    )

@router.post("/incidents/capture-screen")
def manual_capture_screenshot():
    """
    Thực hiện chụp ảnh màn hình thủ công và lưu vào thư mục chứng cứ dumps.
    """
    return incident_manager.capture_screenshot(prefix="manual-capture")

@router.post("/notifications/test")
def test_notification(req: ActionTestRequest):
    """
    Kiểm tra cấu hình gửi thông báo Webhook tới Discord, Telegram, hoặc Slack.
    """
    data = req.model_dump()
    res = dispatch_notification(data)
    return {"status": "ok", "platform": req.platform, "result": res}
