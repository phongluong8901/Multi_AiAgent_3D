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
    armed: Optional[bool] = None

class ActionTestRequest(BaseModel):
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
    return dag_runner.get_guard_status()

@router.post("/guard/toggle")
def toggle_guard(req: GuardToggleRequest = GuardToggleRequest()):
    new_state = dag_runner.toggle_guard(req.armed)
    return {"guard_armed": new_state, "status": "updated"}

@router.post("/action/test")
def test_workflow_action(req: ActionTestRequest):
    data = req.model_dump()
    data["is_test"] = True
    res = execute_node_action(data)
    return {"status": "ok", "action": req.action_type, "result": res}

@router.post("/run-once")
def run_workflow_once(graph: WorkflowGraphRequest):
    events = dag_runner.execute_once(graph)
    return {
        "workflow_id": graph.workflow_id,
        "triggered_events": events,
        "interventions_count": dag_runner.interventions_count,
        "execution_trace": dag_runner.last_execution_trace,
    }

@router.post("/deploy")
async def deploy_continuous_workflow(graph: WorkflowGraphRequest):
    return dag_runner.start_background_workflow(graph)

@router.post("/{workflow_id}/stop")
async def stop_workflow(workflow_id: str):
    return dag_runner.stop_background_workflow(workflow_id)

@router.get("/logs")
def get_workflow_logs():
    return {
        "active_workflows": list(dag_runner.active_tasks.keys()),
        "guard_status": dag_runner.get_guard_status(),
        "logs": dag_runner.execution_logs[-50:]
    }

@router.get("/incidents")
def get_incidents(limit: int = 50, severity: Optional[str] = None):
    return {
        "incidents": incident_manager.get_incidents(limit=limit, severity=severity),
        "total_recorded": len(incident_manager.incidents)
    }

@router.get("/incidents/export")
def export_incidents(format: str = Query("csv", pattern="^(csv|json)$")):
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
    return incident_manager.capture_screenshot(prefix="manual-capture")

@router.post("/notifications/test")
def test_notification(req: ActionTestRequest):
    data = req.model_dump()
    res = dispatch_notification(data)
    return {"status": "ok", "platform": req.platform, "result": res}
