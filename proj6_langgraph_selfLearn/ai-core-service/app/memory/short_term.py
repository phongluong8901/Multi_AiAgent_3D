import json
import redis.asyncio as redis
from ..core.config import settings

class ShortTermMemory:
    def __init__(self):
        self.client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.ttl = 86400  # Nhớ ngữ cảnh phiên trong 24 giờ

    async def get_history(self, session_id: str, limit: int = 10) -> list[dict]:
        key = f"chat:history:{session_id}"
        items = await self.client.lrange(key, -limit, -1)
        return [json.loads(i) for i in items]

    async def add_message(self, session_id: str, role: str, content: str):
        key = f"chat:history:{session_id}"
        await self.client.rpush(key, json.dumps({"role": role, "content": content}))
        await self.client.expire(key, self.ttl)

short_memory = ShortTermMemory()