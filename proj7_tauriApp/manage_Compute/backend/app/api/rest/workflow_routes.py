from fastapi import APIRouter
from app.schemas.workflow_schema import WorkflowGraphRequest
from app.modules.workflow_engine.dag_runner import dag_runner

router = APIRouter(prefix="/workflows", tags=["n8n Workflow Engine"])

@router.post("/run-once")
def run_workflow_once(graph: WorkflowGraphRequest):
    events = dag_runner.execute_once(graph)
    return {"workflow_id": graph.workflow_id, "triggered_events": events}

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
        "logs": dag_runner.execution_logs[-50:]
    }