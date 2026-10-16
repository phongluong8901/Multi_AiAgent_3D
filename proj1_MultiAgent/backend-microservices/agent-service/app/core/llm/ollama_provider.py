import os
from openai import OpenAI
from .base_provider import BaseLLMProvider

class OllamaProvider(BaseLLMProvider):
    def __init__(self):
        # Ollama chạy local trên máy (hoặc qua host.docker.internal trong Docker)
        self.base_url = os.getenv("LOCAL_LLM_BASE_URL", "http://host.docker.internal:11434/v1")
        self.model_name = os.getenv("LOCAL_LLM_MODEL", "qwen2.5")
        
        self.client = OpenAI(
            api_key="ollama", # Ollama không yêu cầu key thực nhưng OpenAI SDK bắt buộc điền
            base_url=self.base_url
        )

    def chat_completion(self, messages, tools=None):
        kwargs = {
            "model": self.model_name,
            "messages": messages,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"
            
        return self.client.chat.completions.create(**kwargs)