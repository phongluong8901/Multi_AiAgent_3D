from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.patterns.codegen_factory import codegen_factory
from app.repositories.device_repository import device_repository
from app.repositories.history_repository import history_repository
from app.schemas.codegen import GenerateFirmwareRequest
from app.schemas.device import FirmwareDeviceRegistration


class DeviceService:
    """Service Layer quản lý vòng đời thiết bị Firmware, nạp Agent (Flash) và lưu lịch sử vào Neon DB."""

    def list_devices(self, db: Session, room_id: Optional[str] = None) -> List[Dict[str, Any]]:
        return device_repository.list_devices(db, room_id=room_id)

    def register_or_flash_device(
        self,
        db: Session,
        payload: FirmwareDeviceRegistration,
        action_type: str = "flash_agent",
    ) -> Dict[str, Any]:
        saved_device = device_repository.upsert_device(db, payload)
        flash_record = history_repository.create_flash_history(
            db,
            device_id=payload.device_id,
            board_type=payload.board_type,
            room_id=payload.room_id,
            agent_id=payload.agent_id,
            sub_agents=payload.sub_agents,
            connection_type=payload.connection_type,
            transport_protocol=payload.transport_protocol,
            firmware_version=payload.firmware_version,
            action_type=action_type,
            filename=f"{payload.board_type}_{payload.agent_id}_{payload.transport_protocol}.ino",
            code_snapshot=payload.logic_script,
            status="success",
            notes=(
                f"Nạp Agent @{payload.agent_id} (Sub-agents: {', '.join(payload.sub_agents)}) "
                f"vào {payload.board_type.upper()} qua {payload.connection_type.upper()}/{payload.transport_protocol.upper()} trong Room '{payload.room_id}'."
            ),
        )
        return {
            "success": True,
            "message": (
                f"Nạp Firmware thành công! Mạch {payload.board_type.upper()} [{payload.device_id}] đã gắn Agent @{payload.agent_id} "
                f"(Kết nối: {payload.connection_type.upper()} | Truyền tải: {payload.transport_protocol.upper()}) trong Room '{payload.room_id}'."
            ),
            "device": saved_device,
            "flash_history": flash_record,
        }

    def generate_and_log_firmware(self, db: Session, req: GenerateFirmwareRequest) -> Dict[str, Any]:
        result = codegen_factory.create_firmware(req)
        history_repository.create_flash_history(
            db,
            device_id=req.agent_name,
            board_type=req.board_type,
            room_id=req.room_id,
            agent_id=req.agent_id,
            sub_agents=req.active_sub_agents,
            connection_type=req.connection_type,
            transport_protocol=req.transport_protocol,
            action_type="generate_code",
            filename=result.get("filename"),
            code_snapshot=result.get("code", "")[:4000],
            status="success",
            notes=f"Sinh mã nguồn {result.get('filename')} ({req.connection_type.upper()} / {req.transport_protocol.upper()})",
        )
        return result

    def delete_device(self, db: Session, device_id: str) -> Dict[str, Any]:
        deleted = device_repository.delete_device(db, device_id)
        return {"success": deleted, "device_id": device_id}


device_service = DeviceService()

