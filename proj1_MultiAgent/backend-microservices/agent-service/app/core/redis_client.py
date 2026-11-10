import os
import redis

def get_redis_client() -> redis.Redis:
    """Khởi tạo và trả về Redis client."""
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    return redis.from_url(redis_url, decode_responses=True)

# Singleton client
redis_client = get_redis_client()
