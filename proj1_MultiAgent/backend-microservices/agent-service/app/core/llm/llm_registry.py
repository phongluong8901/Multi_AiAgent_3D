import os
from .gemini_provider import GeminiProvider
from .ollama_provider import OllamaProvider


class LLMRegistry:
    def __init__(self):
        # Đọc cấu hình provider từ biến môi trường: "gemini" hoặc "local"
        self.provider_type = os.getenv("LLM_PROVIDER", "gemini").lower()
        self.provider = self._load_provider()

    def _load_provider(self):
        if self.provider_type == "local":
            print("[LLM Strategy] Starting local model: OLLAMA")
            return OllamaProvider()
        else:
            print("[LLM Strategy] Starting cloud model: GOOGLE GEMINI")
            return GeminiProvider()

    def get_client(self):
        return self.provider


llm_registry = LLMRegistry()
