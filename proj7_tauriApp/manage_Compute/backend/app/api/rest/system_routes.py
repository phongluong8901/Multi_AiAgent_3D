import platform
import psutil
from fastapi import APIRouter
from app.modules.telemetry.collector import telemetry_collector
from app.schemas.telemetry_schema import SystemSnapshot

router = APIRouter(prefix="/system", tags=["System & Hardware"])

@router.get("/info")
def get_static_host_info():
    return {
        "os": platform.system(),
        "os_release": platform.release(),
        "architecture": platform.machine(),
        "processor": platform.processor(),
        "hostname": platform.node(),
        "boot_time": psutil.boot_time()
    }

@router.get("/snapshot", response_model=SystemSnapshot)
def get_instant_snapshot():
    return telemetry_collector.get_snapshot()