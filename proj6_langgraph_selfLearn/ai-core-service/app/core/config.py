"""
Module cau hinh he thong cho AI Core Service (`config.py`).
Quan ly bien moi truong, API Keys (Google Gemini, Tavily), ket noi Redis, Qdrant Vector DB, va LangSmith tracing.
"""

import os
from typing import Optional
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load .env vao os.environ de tu dong phat hien LangSmith / LangChain tracing
load_dotenv()


class Settings(BaseSettings):
    """
    Lop Settings cau hinh ung dung Pydantic:
    - GOOGLE_API_KEY: Khoa API truy cap mo hinh Google Gemini
    - REDIS_URL: Dia chi ket noi Redis phuc vu bo nho ngan han (Short-term Memory)
    - QDRANT_URL / QDRANT_API_KEY: Dia chi Vector Database phuc vu bo nho dai han (Long-term Memory)
    - GATEWAY_INTERNAL_URL: Endpoint Webhook noi bo goi sang Gateway Service
    - FAST_MODEL / EMBEDDING_MODEL: Mo hinh LLM suy luan va Text Embedding
    - TAVILY_API_KEY: API tim kiem web
    - LangSmith Tracing configurations
    """
    GOOGLE_API_KEY: str
    REDIS_URL: str = "redis://localhost:6379/0"

    # Qdrant (Ho tro ca Local Docker va Qdrant Cloud)
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: Optional[str] = None

    # Gateway URL (de AI Core gui webhook kich hoat Socket.IO realtime)
    GATEWAY_INTERNAL_URL: str = "http://gateway:4000"

    # Models (gemini-3.5-flash-lite toi uu chi phi va toc do)
    FAST_MODEL: str = "gemini-3.5-flash-lite"
    EMBEDDING_MODEL: str = "models/gemini-embedding-001"
    EMBEDDING_DIM: int = 768

    # Search API
    TAVILY_API_KEY: Optional[str] = None

    # LangSmith / LangChain Tracing
    LANGSMITH_TRACING: Optional[str] = None
    LANGCHAIN_TRACING_V2: Optional[str] = None
    LANGSMITH_API_KEY: Optional[str] = None
    LANGCHAIN_API_KEY: Optional[str] = None
    LANGSMITH_PROJECT: Optional[str] = None
    LANGCHAIN_PROJECT: Optional[str] = None
    LANGSMITH_ENDPOINT: Optional[str] = None
    LANGCHAIN_ENDPOINT: Optional[str] = None

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
