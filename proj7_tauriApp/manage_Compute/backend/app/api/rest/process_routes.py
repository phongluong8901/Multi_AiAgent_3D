from fastapi import APIRouter, HTTPException, Query
from typing import List
import psutil
from app.modules.service_manager.os_process import process_manager
from app.schemas.process_schema import ProcessInfo, ProcessActionType, SpawnServiceRequest

router = APIRouter(prefix="/processes", tags=["Processes & Services"])

@router.get("", response_model=List[ProcessInfo])
def get_processes(
    limit: int = Query(30, ge=1, le=200),
    sort_by: str = Query("memory", pattern="^(memory|cpu)$")
):
    return process_manager.list_processes(limit=limit, sort_by=sort_by)

@router.post("/{pid}/{action}")
def control_os_process(pid: int, action: ProcessActionType):
    try:
        return process_manager.control_process(pid, action)
    except psutil.NoSuchProcess:
        raise HTTPException(status_code=404, detail=f"PID {pid} not found")
    except psutil.AccessDenied:
        raise HTTPException(status_code=403, detail=f"Access denied for PID {pid}. Try running as Administrator/root.")

@router.post("/spawn")
def spawn_new_service(payload: SpawnServiceRequest):
    try:
        return process_manager.spawn_managed_service(payload.command, payload.cwd)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))