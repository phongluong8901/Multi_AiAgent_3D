from fastapi import APIRouter, HTTPException, Query
from typing import List
import psutil
from app.modules.service_manager.os_process import process_manager
from app.modules.service_manager.resource_quota_manager import resource_quota_manager
from app.modules.service_manager.network_inspector import network_inspector
from app.schemas.process_schema import (
    ProcessInfo,
    ProcessActionType,
    SpawnServiceRequest,
    SetPriorityRequest,
    SetAffinityRequest,
    ReleasePortRequest,
    ApplyQuotaRequest,
    ProcessNetworkProfile,
    SystemNetworkSummary,
)

router = APIRouter(prefix="/processes", tags=["Processes & Services"])

@router.get("", response_model=List[ProcessInfo])
def get_processes(
    limit: int = Query(30, ge=1, le=200),
    sort_by: str = Query("memory", pattern="^(memory|cpu)$")
):
    return process_manager.list_processes(limit=limit, sort_by=sort_by)

@router.post("/{pid}/trim-memory")
def trim_memory(pid: int):
    try:
        return process_manager.trim_process_memory(pid)
    except psutil.NoSuchProcess:
        raise HTTPException(status_code=404, detail=f"PID {pid} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{pid}/priority")
def set_priority(pid: int, req: SetPriorityRequest):
    try:
        return process_manager.set_process_priority(pid, req.priority)
    except psutil.NoSuchProcess:
        raise HTTPException(status_code=404, detail=f"PID {pid} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{pid}/affinity")
def set_affinity(pid: int, req: SetAffinityRequest):
    try:
        return process_manager.set_process_affinity(pid, req.cores)
    except psutil.NoSuchProcess:
        raise HTTPException(status_code=404, detail=f"PID {pid} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ports/release")
def release_port(req: ReleasePortRequest):
    return process_manager.release_port(req.port)

@router.post("/{pid}/{action}")
def control_os_process(pid: int, action: ProcessActionType):
    try:
        return process_manager.control_process(pid, action)
    except psutil.NoSuchProcess:
        raise HTTPException(status_code=404, detail=f"PID {pid} not found")
    except psutil.AccessDenied:
        raise HTTPException(status_code=403, detail=f"Access denied for PID {pid}. Try running as Administrator/root.")

@router.post("/{pid}/quota")
def apply_process_resource_quota(pid: int, req: ApplyQuotaRequest):
    return resource_quota_manager.apply_quota(
        pid=pid,
        cores=req.cores,
        max_ram_mb=req.max_ram_mb,
        max_cpu_percent=req.max_cpu_percent,
        gpu_index=req.gpu_index,
        policy=req.policy,
    )

@router.get("/{pid}/quota")
def get_process_resource_quota(pid: int):
    q = resource_quota_manager.get_quota(pid)
    if not q:
        return {"pid": pid, "has_quota": False}
    return {"pid": pid, "has_quota": True, "quota": q}

@router.delete("/{pid}/quota")
def remove_process_resource_quota(pid: int):
    return resource_quota_manager.remove_quota(pid)

@router.get("/quotas/list")
def list_active_resource_quotas():
    return {"quotas": resource_quota_manager.list_quotas()}

@router.post("/quotas/enforce")
def enforce_all_resource_quotas():
    actions = resource_quota_manager.enforce_quotas()
    return {"status": "enforced", "actions_taken": actions}

@router.post("/spawn")
def spawn_new_service(payload: SpawnServiceRequest):
    try:
        return process_manager.spawn_managed_service(payload.command, payload.cwd)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{pid}/network", response_model=ProcessNetworkProfile)
def get_process_network(pid: int):
    """
    Lấy danh sách các socket kết nối, điểm cuối API và domain mà tiến trình đang giao tiếp.
    """
    try:
        return network_inspector.get_process_network_profile(pid)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to inspect network for PID {pid}: {str(e)}")

@router.get("/network/summary", response_model=SystemNetworkSummary)
def get_system_network_summary():
    """
    Thống kê tổng quan các luồng kết nối mạng và API của toàn bộ hệ thống.
    """
    try:
        return network_inspector.get_system_network_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get network summary: {str(e)}")

