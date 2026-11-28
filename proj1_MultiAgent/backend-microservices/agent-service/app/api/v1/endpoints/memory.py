from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.api.deps import get_db
from app.schemas.memory_schema import (
    MemoryAddRequest,
    MemoryResponse,
    ShortMemoryResponse,
    ShortMemoryMessage,
)
from app.services.memory_service import memory_service

router = APIRouter(prefix="/memory", tags=["Agent Memory"])


# ─── SHORT MEMORY ENDPOINTS ──────────────────────────────────────────────────

@router.get("/{agent_id}/short", response_model=ShortMemoryResponse)
def get_short_memory(
    agent_id: str,
    room_id: Optional[str] = Query(None, description="Lọc theo room ID"),
):
    """Lấy short-term memory (conversation window) của agent từ Redis."""
    messages = memory_service.get_short_memory(agent_id, room_id)
    return ShortMemoryResponse(
        agent_id=agent_id,
        room_id=room_id,
        messages=[ShortMemoryMessage(**m) for m in messages],
        total_turns=len(messages),
    )


@router.delete("/{agent_id}/short")
def clear_short_memory(
    agent_id: str,
    room_id: Optional[str] = Query(None),
):
    """Xóa toàn bộ short-term memory của agent."""
    memory_service.clear_short_memory(agent_id, room_id)
    return {"success": True, "message": f"Short memory cleared for agent {agent_id}"}


# ─── LONG MEMORY ENDPOINTS ───────────────────────────────────────────────────

@router.get("/{agent_id}/long", response_model=list[MemoryResponse])
def get_long_memories(
    agent_id: str,
    room_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Lấy long-term memories của agent từ PostgreSQL."""
    memories = memory_service.get_long_memories(db, agent_id, room_id, limit)
    return memories


@router.post("/{agent_id}/long", response_model=MemoryResponse)
def add_long_memory(
    agent_id: str,
    payload: MemoryAddRequest,
    db: Session = Depends(get_db),
):
    """Thêm một long-term memory mới cho agent."""
    mem = memory_service.add_long_memory(
        db=db,
        agent_id=agent_id,
        content=payload.content,
        memory_type=payload.memory_type,
        room_id=payload.room_id,
    )
    return mem


@router.delete("/{agent_id}/long/{memory_id}")
def delete_long_memory(
    agent_id: str,
    memory_id: int,
    db: Session = Depends(get_db),
):
    """Xóa một long-term memory cụ thể."""
    success = memory_service.delete_long_memory(db, memory_id, agent_id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"success": True, "message": f"Memory {memory_id} deleted"}
