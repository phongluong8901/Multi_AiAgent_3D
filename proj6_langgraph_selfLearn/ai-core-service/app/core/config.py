import os
from typing import Optional
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load .env into os.environ for LangSmith / LangChain tracing auto-detection
load_dotenv()

class Settings(BaseSettings):
    GOOGLE_API_KEY: str
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Qdrant (Hỗ trợ cả Local Docker và Qdrant Cloud)
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: Optional[str] = None
    
    # Gateway URL (để AI Core gửi webhook kích hoạt Socket.IO realtime)
    GATEWAY_INTERNAL_URL: str = "http://gateway:4000"

    # Models (gemini-3.5-flash-lite có hạn mức 500 requests/ngày)
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
