"""
Short-Term Working Memory Management via Redis.
Maintains sliding-window chat conversation history with TTL-based expiration.
"""

import json
import redis.asyncio as redis
from ..core.config import settings

class ShortTermMemory:
    """
    Manages session-level conversational short-term memory backed by an async Redis client.
    Stores and retrieves message history as a FIFO list with automated TTL eviction.
    """
    def __init__(self):
        """
        Initializes the async Redis connection and configures default 24h retention TTL.
        """
        self.client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.ttl = 86400  # Retain context window for 24 hours

    async def get_history(self, session_id: str, limit: int = 10) -> list[dict]:
        """
        Retrieves the most recent chat turns for a specific session.

        Args:
            session_id: Unique chat session key.
            limit: Maximum number of recent messages to return (default 10).

        Returns:
            List of message dictionaries with 'role' and 'content'.
        """
        key = f"chat:history:{session_id}"
        items = await self.client.lrange(key, -limit, -1)
        return [json.loads(i) for i in items]

    async def add_message(self, session_id: str, role: str, content: str):
        """
        Pushes a new message entry onto the session's Redis list and refreshes the TTL.

        Args:
            session_id: Target session identifier.
            role: Sender role ('user', 'assistant', etc.).
            content: Message body string.
        """
        key = f"chat:history:{session_id}"
        await self.client.rpush(key, json.dumps({"role": role, "content": content}))
        await self.client.expire(key, self.ttl)

# Global short-term memory instance
short_memory = ShortTermMemory()
