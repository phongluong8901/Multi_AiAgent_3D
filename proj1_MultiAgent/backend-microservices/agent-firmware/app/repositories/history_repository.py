from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.models.device import FirmwareDevice
from app.models.flash_history import FirmwareFlashHistory
from app.models.interaction_log import FirmwareInteractionLog
from app.models.telemetry_log import FirmwareTelemetryLog


class HistoryRepository:
    """Repository Pattern quản lý lưu trữ & truy vấn Lịch sử Nạp (Flash), Lịch sử Hội thoại Stream, và Telemetry."""

    def create_flash_history(
        self,
        db: Session,
        *,
        device_id: str,
        board_type: str,
        room_id: str,
        agent_id: str,
        sub_agents: List[str],
        connection_type: str,
        transport_protocol: str,
        firmware_version: str = "v2.4.0-stream",
        action_type: str = "flash_agent",
        filename: Optional[str] = None,
        code_snapshot: Optional[str] = None,
        status: str = "success",
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        entry = FirmwareFlashHistory(
            device_id=device_id,
            board_type=board_type,
            room_id=room_id,
            agent_id=agent_id,
            sub_agents=sub_agents,
            connection_type=connection_type,
            transport_protocol=transport_protocol,
            firmware_version=firmware_version,
            action_type=action_type,
            filename=filename,
            code_snapshot=code_snapshot,
            status=status,
            notes=notes,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return self._flash_to_dict(entry)

    def list_flash_histories(
        self,
        db: Session,
        device_id: Optional[str] = None,
        room_id: Optional[str] = None,
        limit: int = 30,
    ) -> List[Dict[str, Any]]:
        query = db.query(FirmwareFlashHistory)
        if device_id:
            query = query.filter(FirmwareFlashHistory.device_id == device_id)
        if room_id:
            query = query.filter(FirmwareFlashHistory.room_id == room_id)
        rows = query.order_by(FirmwareFlashHistory.created_at.desc()).limit(limit).all()
        return [self._flash_to_dict(r) for r in rows]

    def create_interaction_log(
        self,
        db: Session,
        *,
        device_id: str,
        device_name: str,
        board_type: str,
        room_id: str,
        lead_agent_id: str,
        sub_agents_used: List[str],
        connection_type: str,
        transport_protocol: str,
        user_prompt: str,
        agent_thought: str,
        delegation_steps: List[Dict[str, Any]],
        spoken_response: str,
        hardware_actions: List[Dict[str, Any]],
        obstacle_distance_cm: float = 150.0,
        synced_to_room: bool = True,
        latency_ms: int = 0,
    ) -> Dict[str, Any]:
        log = FirmwareInteractionLog(
            device_id=device_id,
            device_name=device_name,
            board_type=board_type,
            room_id=room_id,
            lead_agent_id=lead_agent_id,
            sub_agents_used=sub_agents_used,
            connection_type=connection_type,
            transport_protocol=transport_protocol,
            user_prompt=user_prompt,
            agent_thought=agent_thought,
            delegation_steps=delegation_steps,
            spoken_response=spoken_response,
            hardware_actions=hardware_actions,
            obstacle_distance_cm=obstacle_distance_cm,
            synced_to_room=synced_to_room,
            latency_ms=latency_ms,
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return self._interaction_to_dict(log)

    def list_interaction_logs(
        self,
        db: Session,
        device_id: Optional[str] = None,
        room_id: Optional[str] = None,
        limit: int = 40,
    ) -> List[Dict[str, Any]]:
        query = db.query(FirmwareInteractionLog)
        if device_id:
            query = query.filter(FirmwareInteractionLog.device_id == device_id)
        if room_id:
            query = query.filter(FirmwareInteractionLog.room_id == room_id)
        rows = query.order_by(FirmwareInteractionLog.created_at.desc()).limit(limit).all()
        return [self._interaction_to_dict(r) for r in rows]

    def create_telemetry_log(
        self,
        db: Session,
        *,
        device_id: str,
        board_type: str,
        room_id: str,
        obstacle_distance_cm: float,
        battery_voltage: float = 7.4,
        wifi_rssi_dbm: int = -52,
        pos_x: float = 0.0,
        pos_z: float = 0.0,
        rotation_deg: float = 0.0,
        led_color: str = "#10b981",
    ) -> Dict[str, Any]:
        t = FirmwareTelemetryLog(
            device_id=device_id,
            board_type=board_type,
            room_id=room_id,
            obstacle_distance_cm=obstacle_distance_cm,
            battery_voltage=battery_voltage,
            wifi_rssi_dbm=wifi_rssi_dbm,
            pos_x=pos_x,
            pos_z=pos_z,
            rotation_deg=rotation_deg,
            led_color=led_color,
        )
        db.add(t)
        db.commit()
        db.refresh(t)
        return self._telemetry_to_dict(t)

    def list_telemetry_logs(
        self,
        db: Session,
        device_id: Optional[str] = None,
        room_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        query = db.query(FirmwareTelemetryLog)
        if device_id:
            query = query.filter(FirmwareTelemetryLog.device_id == device_id)
        if room_id:
            query = query.filter(FirmwareTelemetryLog.room_id == room_id)
        rows = query.order_by(FirmwareTelemetryLog.created_at.desc()).limit(limit).all()
        return [self._telemetry_to_dict(r) for r in rows]

    def get_summary_stats(self, db: Session, room_id: Optional[str] = None) -> Dict[str, Any]:
        dev_count = db.query(FirmwareDevice).count()
        flash_count = db.query(FirmwareFlashHistory).count()
        inter_q = db.query(FirmwareInteractionLog)
        if room_id:
            inter_q = inter_q.filter(FirmwareInteractionLog.room_id == room_id)
        interaction_count = inter_q.count()
        telem_count = db.query(FirmwareTelemetryLog).count()
        return {
            "total_devices": dev_count,
            "total_flashes": flash_count,
            "total_interactions": interaction_count,
            "total_telemetry_points": telem_count,
        }

    @staticmethod
    def _flash_to_dict(r: FirmwareFlashHistory) -> Dict[str, Any]:
        return {
            "id": r.id,
            "device_id": r.device_id,
            "board_type": r.board_type,
            "room_id": r.room_id,
            "agent_id": r.agent_id,
            "sub_agents": r.sub_agents or [],
            "connection_type": r.connection_type,
            "transport_protocol": r.transport_protocol,
            "firmware_version": r.firmware_version,
            "action_type": r.action_type,
            "filename": r.filename,
            "status": r.status,
            "notes": r.notes,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }

    @staticmethod
    def _interaction_to_dict(r: FirmwareInteractionLog) -> Dict[str, Any]:
        return {
            "id": r.id,
            "device_id": r.device_id,
            "device_name": r.device_name,
            "board_type": r.board_type,
            "room_id": r.room_id,
            "lead_agent_id": r.lead_agent_id,
            "sub_agents_used": r.sub_agents_used or [],
            "connection_type": r.connection_type,
            "transport_protocol": r.transport_protocol,
            "user_prompt": r.user_prompt,
            "agent_thought": r.agent_thought,
            "delegation_steps": r.delegation_steps or [],
            "spoken_response": r.spoken_response,
            "hardware_actions": r.hardware_actions or [],
            "obstacle_distance_cm": r.obstacle_distance_cm,
            "synced_to_room": bool(r.synced_to_room),
            "latency_ms": r.latency_ms,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }

    @staticmethod
    def _telemetry_to_dict(r: FirmwareTelemetryLog) -> Dict[str, Any]:
        return {
            "id": r.id,
            "device_id": r.device_id,
            "board_type": r.board_type,
            "room_id": r.room_id,
            "obstacle_distance_cm": r.obstacle_distance_cm,
            "battery_voltage": r.battery_voltage,
            "wifi_rssi_dbm": r.wifi_rssi_dbm,
            "pos_x": r.pos_x,
            "pos_z": r.pos_z,
            "rotation_deg": r.rotation_deg,
            "led_color": r.led_color,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }


history_repository = HistoryRepository()

