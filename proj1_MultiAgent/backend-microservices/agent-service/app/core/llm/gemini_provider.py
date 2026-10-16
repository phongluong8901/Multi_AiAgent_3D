import os
from openai import OpenAI
from .base_provider import BaseLLMProvider

class GeminiProvider(BaseLLMProvider):
    def __init__(self):
        self.api_key = os.getenv("GOOGLE_API_KEY", "")
        # Điểm cuối chuẩn OpenAI-compatible của Google AI Studio
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash") # Hoặc model phù hợp
        
        self.client = OpenAI(
            api_key=self.api_key,
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