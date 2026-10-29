import os
from typing import Optional
from .gemini_provider import GeminiProvider
from .ollama_provider import OllamaProvider


class LLMRegistry:
    def __init__(self):
        # Đọc cấu hình provider mặc định: "gemini" hoặc "local"
        self.provider_type = os.getenv("LLM_PROVIDER", "gemini").lower()
        self.default_gemini = GeminiProvider()
        self.default_ollama = OllamaProvider()

    def get_client(self, model_name: Optional[str] = None):
        """
        Lấy LLM Provider động dựa trên cấu hình model của Agent:
        - Nếu model_name bắt đầu bằng 'rented:' hoặc 'rental:':
          Chuyển tiếp tới OllamaProvider cấu hình phiên thuê Seller P2P Mesh.
        - Nếu model_name thuộc các mô hình local (ollama:, local:, qwen, llama, deepseek-r1, phi, mistral, gemma):
          Chuyển sang OllamaProvider.
        - Mặc định: Dùng GeminiProvider (hoặc Ollama nếu LLM_PROVIDER=local).
        """
        if not model_name:
            return self.default_ollama if self.provider_type == "local" else self.default_gemini

        raw_str = str(model_name).strip()
        lower_str = raw_str.lower()

        # Kiểm tra mô hình thuê từ máy Seller
        if lower_str.startswith("rented:") or lower_str.startswith("rental:"):
            print(f"[LLM Registry] Dynamic Provider: RENTED SELLER NODE -> {raw_str}")
            return OllamaProvider(model_name=raw_str)

        # Kiểm tra mô hình Ollama cục bộ
        if (
            lower_str.startswith("ollama:")
            or lower_str.startswith("local:")
            or lower_str.startswith("ollama/")
            or lower_str.startswith("local/")
            or "qwen" in lower_str
            or "llama" in lower_str
            or "deepseek-r1" in lower_str
            or "mistral" in lower_str
            or "phi" in lower_str
            or "gemma" in lower_str
        ):
            return OllamaProvider(model_name=raw_str)

        # Mặc định: Google Gemini / Cloud Providers
        return self.default_gemini


llm_registry = LLMRegistry()
