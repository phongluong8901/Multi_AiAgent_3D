"""
Router REST API Thông tin Hệ thống & Phân vùng Bộ nhớ:
Cung cấp thông tin phần cứng tĩnh, ảnh chụp nhanh Telemetry (CPU, RAM, GPU, Disk, Net),
chẩn đoán sức khỏe hệ thống (Health Advisor), và quản lý / dọn dẹp các phân vùng bộ nhớ (Purge Memory Partitions).
"""

import platform
import psutil
from fastapi import APIRouter
from app.modules.telemetry.collector import telemetry_collector
from app.modules.telemetry.health_advisor import calculate_health_and_recommendations
from app.modules.service_manager.partition_manager import partition_manager
from app.schemas.telemetry_schema import SystemSnapshot
from app.schemas.partition_schema import (
    SystemPartitionsOverview,
    PartitionPurgeRequest,
    PartitionPurgeResult,
)

router = APIRouter(prefix="/system", tags=["System & Hardware"])

@router.get("/info")
def get_static_host_info():
    """
    Lấy thông tin tĩnh về hệ điều hành, kiến trúc vi xử lý, tên máy chủ và thời điểm khởi động máy.
    """
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
    """
    Lấy bản chụp trạng thái tài nguyên phần cứng tức thì (CPU, RAM, Disk, Mạng, GPU NVIDIA, Top tiến trình).
    """
    return telemetry_collector.get_snapshot()

@router.get("/health")
def get_system_health():
    """
    Tính toán chỉ số sức khỏe tổng thể (Health Score 0-100%) và đưa ra khuyến nghị tối ưu hóa hệ thống.
    """
    snapshot = telemetry_collector.get_snapshot()
    return calculate_health_and_recommendations(snapshot)

@router.get("/partitions", response_model=SystemPartitionsOverview)
def get_memory_partitions():
    """
    Trả về danh sách các phân vùng bộ nhớ (RAM Pools, Standby Cache, Swap, SSD, HDD, Temp Cache).
    """
    return partition_manager.get_system_partitions()

@router.post("/partitions/purge", response_model=PartitionPurgeResult)
def purge_memory_partition(req: PartitionPurgeRequest):
    """
    Thực hiện giải phóng / dọn dẹp phân vùng bộ nhớ chỉ định (Standby Cache, Temp, Dumps, Working Sets).
    """
    return partition_manager.purge_partition(req.partition_id, req.mode)
