import json
from typing import List, Dict, Optional
from sqlalchemy.orm import Session

from app.core.redis_client import redis_client
from app.models.memory import AgentMemoryModel

# Số lượng tin nhắn tối đa trong short memory (sliding window)
SHORT_MEMORY_MAX_TURNS = 10
# TTL của short memory trong Redis (1 giờ)
SHORT_MEMORY_TTL_SECONDS = 3600


def _short_memory_key(agent_id: str, room_id: Optional[str] = None) -> str:
    """Tạo Redis key cho short memory."""
    if room_id:
        return f"short_memory:{agent_id}:{room_id}"
    return f"short_memory:{agent_id}"


class MemoryService:
    # ─── SHORT MEMORY (Redis) ─────────────────────────────────────────────────

    def get_short_memory(
        self, agent_id: str, room_id: Optional[str] = None
    ) -> List[Dict[str, str]]:
        """Lấy sliding window conversation từ Redis."""
        key = _short_memory_key(agent_id, room_id)
        try:
            raw = redis_client.get(key)
            if raw:
                return json.loads(raw)
        except Exception as e:
            print(f"[MemoryService] Redis get error: {e}")
        return []

    def append_short_memory(
        self,
        agent_id: str,
        role: str,
        content: str,
        room_id: Optional[str] = None,
    ) -> None:
        """Thêm một turn mới vào short memory, giới hạn theo SHORT_MEMORY_MAX_TURNS."""
        key = _short_memory_key(agent_id, room_id)
        try:
            messages = self.get_short_memory(agent_id, room_id)
            messages.append({"role": role, "content": content})
            # Giữ lại SHORT_MEMORY_MAX_TURNS * 2 entries (user + assistant)
            messages = messages[-(SHORT_MEMORY_MAX_TURNS * 2):]
            redis_client.setex(key, SHORT_MEMORY_TTL_SECONDS, json.dumps(messages))
        except Exception as e:
            print(f"[MemoryService] Redis append error: {e}")

    def clear_short_memory(
        self, agent_id: str, room_id: Optional[str] = None
    ) -> None:
        """Xóa toàn bộ short memory của agent."""
        key = _short_memory_key(agent_id, room_id)
        try:
            redis_client.delete(key)
        except Exception as e:
            print(f"[MemoryService] Redis delete error: {e}")

    # ─── LONG MEMORY (PostgreSQL) ─────────────────────────────────────────────

    def get_long_memories(
        self,
        db: Session,
        agent_id: str,
        room_id: Optional[str] = None,
        limit: int = 20,
    ) -> List[AgentMemoryModel]:
        """Lấy danh sách long-term memories của agent."""
        query = db.query(AgentMemoryModel).filter(
            AgentMemoryModel.agent_id == agent_id
        )
        if room_id:
            query = query.filter(AgentMemoryModel.room_id == room_id)
        return query.order_by(AgentMemoryModel.created_at.desc()).limit(limit).all()

    def add_long_memory(
        self,
        db: Session,
        agent_id: str,
        content: str,
        memory_type: str = "fact",
        room_id: Optional[str] = None,
    ) -> AgentMemoryModel:
        """Thêm một memory mới vào long-term storage."""
        mem = AgentMemoryModel(
            agent_id=agent_id,
            room_id=room_id,
            memory_type=memory_type,
            content=content,
        )
        db.add(mem)
        db.commit()
        db.refresh(mem)
        return mem

    def delete_long_memory(self, db: Session, memory_id: int, agent_id: str) -> bool:
        """Xóa một memory cụ thể."""
        mem = (
            db.query(AgentMemoryModel)
            .filter(AgentMemoryModel.id == memory_id, AgentMemoryModel.agent_id == agent_id)
            .first()
        )
        if not mem:
            return False
        db.delete(mem)
        db.commit()
        return True

    def format_long_memories_as_context(
        self, memories: List[AgentMemoryModel]
    ) -> str:
        """Chuyển đổi long memories thành đoạn text để inject vào system prompt."""
        if not memories:
            return ""
        lines = ["[Long-term Memory]"]
        for m in memories:
            lines.append(f"- [{m.memory_type.upper()}] {m.content}")
        return "\n".join(lines)


memory_service = MemoryService()
