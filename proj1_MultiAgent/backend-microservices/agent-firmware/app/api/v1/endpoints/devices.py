from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas.device import FirmwareDeviceRegistration
from app.services.device_service import device_service

router = APIRouter(prefix="/firmware/devices", tags=["Firmware Devices (Neon DB)"])


@router.get("")
def list_firmware_devices(
    room_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Truy vấn danh sách tất cả các thiết bị Firmware đã đăng ký trong cơ sở dữ liệu Neon PostgreSQL.
    Hỗ trợ lọc theo mã phòng làm việc (`room_id`).
    """
    devices = device_service.list_devices(db, room_id=room_id)
    return {"success": True, "devices": devices}


@router.post("")
def register_or_flash_device(
    payload: FirmwareDeviceRegistration,
    db: Session = Depends(get_db),
):
    """
    Đăng ký mới một thiết bị Firmware hoặc nạp cấu hình Agent ban đầu vào database.
    """
    return device_service.register_or_flash_device(db, payload, action_type="register_device")


@router.post("/{device_id}/flash")
def flash_agent_to_device(
    device_id: str,
    payload: FirmwareDeviceRegistration,
    db: Session = Depends(get_db),
):
    """
    Thực hiện nạp Agent (Flash Agent) vào thiết bị phần cứng cụ thể:
    Lưu trữ cấu hình vi điều khiển, cập nhật trạng thái thiết bị và lưu snapshot mã nguồn vào bảng lịch sử.
    """
    payload.device_id = device_id
    return device_service.register_or_flash_device(db, payload, action_type="flash_agent")


@router.delete("/{device_id}")
def delete_firmware_device(
    device_id: str,
    db: Session = Depends(get_db),
):
    """
    Xóa bản ghi thiết bị phần cứng khỏi hệ thống Neon PostgreSQL.
    """
    return device_service.delete_device(db, device_id)
