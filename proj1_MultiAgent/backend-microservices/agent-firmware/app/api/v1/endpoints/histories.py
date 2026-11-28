from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas.interaction import TelemetryLogCreate
from app.services.history_service import history_service

router = APIRouter(prefix="/firmware/histories", tags=["Firmware Histories & Telemetry (Neon DB)"])


@router.get("/overview")
def get_history_overview(
    room_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    return history_service.get_overview(db, room_id=room_id)


@router.get("/interactions")
def list_interaction_histories(
    device_id: Optional[str] = Query(default=None),
    room_id: Optional[str] = Query(default=None),
    limit: int = Query(default=40, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return history_service.get_interactions(db, device_id=device_id, room_id=room_id, limit=limit)


@router.get("/flashes")
def list_flash_histories(
    device_id: Optional[str] = Query(default=None),
    room_id: Optional[str] = Query(default=None),
    limit: int = Query(default=30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return history_service.get_flashes(db, device_id=device_id, room_id=room_id, limit=limit)


@router.get("/telemetry")
def list_telemetry_histories(
    device_id: Optional[str] = Query(default=None),
    room_id: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=300),
    db: Session = Depends(get_db),
):
    return history_service.get_telemetry(db, device_id=device_id, room_id=room_id, limit=limit)


@router.post("/telemetry")
def record_telemetry_snapshot(
    payload: TelemetryLogCreate,
    db: Session = Depends(get_db),
):
    return history_service.record_telemetry(db, payload)

