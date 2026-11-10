from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


class BaseLLMProvider(ABC):
    """Lớp trừu tượng chuẩn hóa cách gọi LLM, giúp dễ dàng đổi provider (Gemini Cloud <-> Ollama Local)"""

    @abstractmethod
    def chat_completion(
        self,
        messages: List[Any],
        temperature: float = 0.2,
        tools: Optional[List[Dict[str, Any]]] = None,
        **kwargs,
    ) -> Any:
        """Thực thi gửi tin nhắn và nhận phản hồi từ LLM (hỗ trợ cả Function Calling)"""
        pass

    @abstractmethod
    def stream_chat_completion(
        self,
        messages: List[Any],
        temperature: float = 0.2,
        tools: Optional[List[Dict[str, Any]]] = None,
        **kwargs,
    ) -> Any:
        """Thực thi streaming token hoặc tool call từ LLM"""
        pass
