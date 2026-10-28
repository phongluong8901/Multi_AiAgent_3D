import os
import json
import urllib.request
from .base_provider import BaseLLMProvider


class _OllamaMessageMock:
    def __init__(self, content="", tool_calls=None):
        self.content = content
        self.tool_calls = tool_calls or []


class _OllamaChoiceMock:
    def __init__(self, message):
        self.message = message


class _OllamaResponseMock:
    def __init__(self, choices):
        self.choices = choices


class OllamaProvider(BaseLLMProvider):
    def __init__(self):
        self.base_url = os.getenv("LOCAL_LLM_BASE_URL", "http://host.docker.internal:11434/v1")
        self.default_model = os.getenv("LOCAL_LLM_MODEL", "qwen2.5-coder:1.5b")
        self.owner_service_urls = [
            os.getenv("OWER_SERVICE_URL", "http://ower-service:5012"),
            "http://localhost:5012",
        ]

    @staticmethod
    def _extract_prompts(messages):
        system_prompt = "Bạn là một AI Agent chuyên nghiệp trong văn phòng 3D."
        conversation_parts = []

        for msg in messages:
            if isinstance(msg, dict):
                role = msg.get("role", "user")
                content = msg.get("content", "")
            else:
                cls_name = type(msg).__name__.lower()
                content = getattr(msg, "content", "") or ""
                if "system" in cls_name:
                    role = "system"
                elif "ai" in cls_name or "assistant" in cls_name:
                    role = "assistant"
                elif "tool" in cls_name:
                    role = "tool"
                else:
                    role = "user"

            if role == "system":
                system_prompt = str(content)
            elif role == "assistant":
                conversation_parts.append(f"Assistant: {content}")
            elif role == "tool":
                conversation_parts.append(f"[Kết quả công cụ]: {content}")
            else:
                conversation_parts.append(f"User: {content}")

        final_prompt = "\n\n".join(conversation_parts) if conversation_parts else "Xin chào"
        return system_prompt, final_prompt

    def _call_via_owner_rental(self, rental_session_id, agent_id, prompt, system_prompt, temperature=0.7):
        payload = {
            "rentalSessionId": rental_session_id or "",
            "agentId": agent_id or "",
            "prompt": prompt,
            "systemPrompt": system_prompt,
            "temperature": temperature or 0.7,
            "maxTokens": 1024,
        }
        for base_url in self.owner_service_urls:
            try:
                req = urllib.request.Request(
                    f"{base_url}/api/v1/owner/agents/inference",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=24) as resp:
                    res_data = json.loads(resp.read().decode("utf-8"))
                    if res_data.get("success") and res_data.get("output"):
                        return res_data["output"]
            except Exception:
                continue
        return None

    def _call_direct_ollama(self, model_name, prompt, system_prompt, temperature=0.7):
        raw_model = (model_name or self.default_model).replace("ollama:", "").replace("local:", "")
        if raw_model.startswith("rental:"):
            raw_model = self.default_model

        ollama_hosts = [
            os.getenv("OLLAMA_HOST", "http://host.docker.internal:11434"),
            "http://localhost:11434",
            "http://127.0.0.1:11434",
        ]
        payload = {
            "model": raw_model,
            "prompt": prompt,
            "system": system_prompt,
            "stream": False,
            "options": {
                "temperature": float(temperature if temperature is not None else 0.7),
                "num_predict": 1024,
            },
        }
        for host in ollama_hosts:
            try:
                req = urllib.request.Request(
                    f"{host.rstrip('/')}/api/generate",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=20) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    if data.get("response"):
                        return data["response"]
            except Exception:
                continue
        raise RuntimeError(
            f"Không thể kết nối tới phiên thuê Local LLM hoặc Ollama cho model '{model_name}'. Hãy đảm bảo bạn đã thuê máy trên /owner hoặc bật Ollama."
        )

    def chat_completion(self, messages, tools=None, agent_id=None, model=None, temperature=None):
        system_prompt, final_prompt = self._extract_prompts(messages)
        rental_id = None
        if model and str(model).startswith("rental:"):
            rental_id = str(model).split("rental:", 1)[1]

        # 1. Ưu tiên định tuyến qua ower-service -> seller-service -> P2P Worker / Ollama (để tính token & trừ SaveCoin)
        output_text = self._call_via_owner_rental(
            rental_session_id=rental_id,
            agent_id=agent_id,
            prompt=final_prompt,
            system_prompt=system_prompt,
            temperature=temperature,
        )

        # 2. Fallback gọi trực tiếp Ollama nếu chưa mở phiên thuê trên ower-service
        if not output_text:
            output_text = self._call_direct_ollama(
                model_name=model,
                prompt=final_prompt,
                system_prompt=system_prompt,
                temperature=temperature,
            )

        msg_mock = _OllamaMessageMock(content=output_text, tool_calls=[])
        return _OllamaResponseMock(choices=[_OllamaChoiceMock(message=msg_mock)])

    def stream_chat_completion(self, messages, tools=None, agent_id=None, model=None, temperature=None):
        resp = self.chat_completion(
            messages=messages,
            tools=tools,
            agent_id=agent_id,
            model=model,
            temperature=temperature,
        )
        text = resp.choices[0].message.content or ""
        yield {"type": "token", "content": text}
