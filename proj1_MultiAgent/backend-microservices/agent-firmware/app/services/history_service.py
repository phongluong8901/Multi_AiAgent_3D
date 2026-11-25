from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from app.repositories.history_repository import history_repository
from app.schemas.interaction import TelemetryLogCreate


class HistoryService:
    """Service Layer quản lý lịch sử Hội thoại Thực-Ảo, Lịch sử Nạp (Flash) và Telemetry cảm biến."""

    def get_interactions(
        self,
        db: Session,
        device_id: Optional[str] = None,
        room_id: Optional[str] = None,
        limit: int = 40,
    ) -> Dict[str, Any]:
        items = history_repository.list_interaction_logs(db, device_id=device_id, room_id=room_id, limit=limit)
        return {"success": True, "count": len(items), "interactions": items}

    def get_flashes(
        self,
        db: Session,
        device_id: Optional[str] = None,
        room_id: Optional[str] = None,
        limit: int = 30,
    ) -> Dict[str, Any]:
        items = history_repository.list_flash_histories(db, device_id=device_id, room_id=room_id, limit=limit)
        return {"success": True, "count": len(items), "flashes": items}

    def get_telemetry(
        self,
        db: Session,
        device_id: Optional[str] = None,
        room_id: Optional[str] = None,
        limit: int = 50,
    ) -> Dict[str, Any]:
        items = history_repository.list_telemetry_logs(db, device_id=device_id, room_id=room_id, limit=limit)
        return {"success": True, "count": len(items), "telemetry": items}

    def record_telemetry(self, db: Session, payload: TelemetryLogCreate) -> Dict[str, Any]:
        saved = history_repository.create_telemetry_log(
            db,
            device_id=payload.device_id,
            board_type=payload.board_type,
            room_id=payload.room_id,
            obstacle_distance_cm=payload.obstacle_distance_cm,
            battery_voltage=payload.battery_voltage,
            wifi_rssi_dbm=payload.wifi_rssi_dbm,
            pos_x=payload.pos_x,
            pos_z=payload.pos_z,
            rotation_deg=payload.rotation_deg,
            led_color=payload.led_color,
        )
        return {"success": True, "telemetry": saved}

    def get_overview(self, db: Session, room_id: Optional[str] = None) -> Dict[str, Any]:
        stats = history_repository.get_summary_stats(db, room_id=room_id)
        recent_interactions = history_repository.list_interaction_logs(db, room_id=room_id, limit=10)
        recent_flashes = history_repository.list_flash_histories(db, room_id=room_id, limit=10)
        return {
            "success": True,
            "stats": stats,
            "recent_interactions": recent_interactions,
            "recent_flashes": recent_flashes,
        }


history_service = HistoryService()

