from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.models.device import FirmwareDevice
from app.schemas.device import FirmwareDeviceRegistration


class DeviceRepository:
    """Repository Pattern quản lý truy vấn bảng `firmware_devices` trên Neon PostgreSQL."""

    @staticmethod
    def to_dict(model: FirmwareDevice) -> Dict[str, Any]:
        return {
            "device_id": model.device_id,
            "device_name": model.device_name,
            "board_type": model.board_type,
            "room_id": model.room_id,
            "agent_id": model.agent_id,
            "sub_agents": model.sub_agents or [],
            "connection_type": model.connection_type,
            "transport_protocol": model.transport_protocol,
            "connection_profile": model.connection_profile or {},
            "enable_voice_tts": bool(model.enable_voice_tts),
            "firmware_version": model.firmware_version,
            "status": model.status,
            "logic_script": model.logic_script,
            "metadata": model.extra_metadata or {},
            "last_seen_at": model.last_seen_at.isoformat() if model.last_seen_at else None,
            "created_at": model.created_at.isoformat() if model.created_at else None,
            "updated_at": model.updated_at.isoformat() if model.updated_at else None,
        }

    def list_devices(self, db: Session, room_id: Optional[str] = None) -> List[Dict[str, Any]]:
        query = db.query(FirmwareDevice)
        if room_id:
            query = query.filter((FirmwareDevice.room_id == room_id) | (FirmwareDevice.room_id == "default_room"))
        rows = query.order_by(FirmwareDevice.updated_at.desc()).all()
        return [self.to_dict(r) for r in rows]

    def get_device(self, db: Session, device_id: str) -> Optional[FirmwareDevice]:
        return db.query(FirmwareDevice).filter(FirmwareDevice.device_id == device_id).first()

    def upsert_device(self, db: Session, payload: FirmwareDeviceRegistration) -> Dict[str, Any]:
        existing = self.get_device(db, payload.device_id)
        now = datetime.utcnow()
        profile_dict = (
            payload.connection_profile.model_dump()
            if hasattr(payload.connection_profile, "model_dump")
            else dict(payload.connection_profile or {})
        )

        if existing:
            existing.device_name = payload.device_name
            existing.board_type = payload.board_type
            existing.room_id = payload.room_id
            existing.agent_id = payload.agent_id
            existing.sub_agents = payload.sub_agents
            existing.connection_type = payload.connection_type
            existing.transport_protocol = payload.transport_protocol
            existing.connection_profile = profile_dict
            existing.enable_voice_tts = payload.enable_voice_tts
            existing.firmware_version = payload.firmware_version
            existing.status = payload.status
            if payload.logic_script is not None:
                existing.logic_script = payload.logic_script
            existing.extra_metadata = payload.metadata or {}
            existing.last_seen_at = now
            existing.updated_at = now
            db.commit()
            db.refresh(existing)
            return self.to_dict(existing)

        new_dev = FirmwareDevice(
            device_id=payload.device_id,
            device_name=payload.device_name,
            board_type=payload.board_type,
            room_id=payload.room_id,
            agent_id=payload.agent_id,
            sub_agents=payload.sub_agents,
            connection_type=payload.connection_type,
            transport_protocol=payload.transport_protocol,
            connection_profile=profile_dict,
            enable_voice_tts=payload.enable_voice_tts,
            firmware_version=payload.firmware_version,
            status=payload.status,
            logic_script=payload.logic_script,
            extra_metadata=payload.metadata or {},
            last_seen_at=now,
            created_at=now,
            updated_at=now,
        )
        db.add(new_dev)
        db.commit()
        db.refresh(new_dev)
        return self.to_dict(new_dev)

    def delete_device(self, db: Session, device_id: str) -> bool:
        existing = self.get_device(db, device_id)
        if not existing:
            return False
        db.delete(existing)
        db.commit()
        return True


device_repository = DeviceRepository()

