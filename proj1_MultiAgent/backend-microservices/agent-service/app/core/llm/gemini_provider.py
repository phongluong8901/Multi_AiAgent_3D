import json
import os
import time
import urllib.request
from typing import List, Dict, Any, Generator, Optional
from google import genai
from google.genai import types
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from app.core.config import settings
from .base_provider import BaseLLMProvider


# Các lớp Mock giúp đồng nhất đầu ra của Gemini/OpenAI giống với chuẩn OpenAI SDK
class _FunctionMock:
    def __init__(self, name: str, arguments: str):
        self.name = name
        self.arguments = arguments


class _ToolCallMock:
    def __init__(self, call_id: str, name: str, arguments: Dict[str, Any]):
        self.id = call_id
        self.type = "function"
        self.function = _FunctionMock(
            name=name,
            arguments=json.dumps(arguments, ensure_ascii=False),
        )


class _MessageMock:
    def __init__(self, content: str, tool_calls: Optional[List[_ToolCallMock]] = None):
        self.content = content
        self.tool_calls = tool_calls or []


class _ChoiceMock:
    def __init__(self, message: _MessageMock):
        self.message = message


class _ResponseMock:
    def __init__(self, content: str, tool_calls: Optional[List[_ToolCallMock]] = None):
        self.choices = [_ChoiceMock(_MessageMock(content, tool_calls))]


class GeminiProvider(BaseLLMProvider):
    """
    Cloud LLM Provider đa năng:
    - Hỗ trợ trực tiếp Google Gemini (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`, `gemini-2.5-flash-lite`) với cơ chế xoay vòng API Key & Fallback model tự động.
    - Hỗ trợ OpenAI / DeepSeek REST API (`gpt-4o`, `gpt-4o-mini`, `deepseek-chat`, `deepseek-reasoner`) khi có `OPENAI_API_KEY` hoặc `DEEPSEEK_API_KEY`.
    - Tự động ánh xạ mượt mà về `gemini-2.5-flash` nếu người dùng chọn model ngoại lai mà chưa cấu hình API key riêng.
    """

    FALLBACK_MODELS = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-2.5-flash-lite",
    ]

    def __init__(self, model_name: Optional[str] = None):
        raw_model_key = (
            os.getenv("GOOGLE_API_KEY_MODEL")
            or getattr(settings, "GOOGLE_API_KEY_MODEL", "")
            or ""
        )
        raw_fallback_key = (
            os.getenv("GOOGLE_API_KEY")
            or getattr(settings, "GOOGLE_API_KEY", "")
            or os.getenv("GEMINI_API_KEY")
            or getattr(settings, "GEMINI_API_KEY", "")
            or ""
        )

        combined_keys = []
        for source in (raw_model_key, raw_fallback_key):
            for k in source.split(","):
                k_clean = k.strip()
                if k_clean and k_clean not in combined_keys:
                    combined_keys.append(k_clean)

        self.api_keys = combined_keys
        if not self.api_keys:
            raise ValueError(
                "Chưa cấu hình GOOGLE_API_KEY_MODEL (hoặc GOOGLE_API_KEY) trong file .env"
            )

        self.current_key_index = 0
        self.client = genai.Client(api_key=self.api_keys[self.current_key_index])
        default_model = (
            os.getenv("GEMINI_MODEL")
            or getattr(settings, "GEMINI_MODEL", "")
            or "gemini-2.5-flash-lite"
        )
        self.model_name = model_name or default_model
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.deepseek_api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()

    def _rotate_key(self) -> bool:
        """Xoay vòng sang API Key tiếp theo nếu có nhiều hơn 1 key."""
        if len(self.api_keys) <= 1:
            return False
        self.current_key_index = (self.current_key_index + 1) % len(self.api_keys)
        new_key = self.api_keys[self.current_key_index]
        masked_key = f"...{new_key[-6:]}" if len(new_key) > 6 else "***"
        print(
            f"[GeminiProvider] Đổi sang API Key #{self.current_key_index + 1}/{len(self.api_keys)} ({masked_key})"
        )
        self.client = genai.Client(api_key=new_key)
        return True

    def _resolve_gemini_model_name(self, requested_model: str) -> str:
        """Đảm bảo tên model gửi tới Google GenAI luôn hợp lệ."""
        m = (requested_model or "gemini-2.5-flash").strip()
        if m.startswith("gemini-"):
            return m
        return "gemini-2.5-flash"

    def _get_model_candidates(self) -> List[str]:
        """Trả về danh sách các model Gemini sẽ thử lần lượt."""
        primary = self._resolve_gemini_model_name(self.model_name)
        candidates = [primary]
        for fb in self.FALLBACK_MODELS:
            if fb not in candidates:
                candidates.append(fb)
        return candidates

    def _try_openai_compatible_api(
        self,
        messages: List[Any],
        temperature: float,
        tools: Optional[List[Dict[str, Any]]] = None,
    ) -> _ResponseMock | None:
        """Nếu model là gpt-* hoặc deepseek-* và có API Key tương ứng, gọi trực tiếp chuẩn OpenAI REST."""
        m_lower = self.model_name.lower()
        api_url = None
        api_key = None

        if m_lower.startswith("gpt-") and self.openai_api_key:
            api_url = "https://api.openai.com/v1/chat/completions"
            api_key = self.openai_api_key
        elif m_lower.startswith("deepseek-") and self.deepseek_api_key:
            api_url = "https://api.deepseek.com/chat/completions"
            api_key = self.deepseek_api_key

        if not api_url or not api_key:
            return None

        try:
            formatted_msgs = []
            for m in messages:
                content = m.content if hasattr(m, "content") else (m.get("content", "") if isinstance(m, dict) else str(m))
                role = getattr(m, "role", None) or (m.get("role") if isinstance(m, dict) else None) or ""
                if isinstance(m, SystemMessage) or role == "system":
                    formatted_msgs.append({"role": "system", "content": str(content)})
                elif isinstance(m, AIMessage) or role == "assistant":
                    formatted_msgs.append({"role": "assistant", "content": str(content)})
                elif isinstance(m, ToolMessage) or role == "tool":
                    formatted_msgs.append({"role": "user", "content": f"[Kết quả từ công cụ]: {content}"})
                else:
                    formatted_msgs.append({"role": "user", "content": str(content)})

            payload: Dict[str, Any] = {
                "model": self.model_name,
                "messages": formatted_msgs,
                "temperature": temperature,
            }
            if tools:
                payload["tools"] = tools

            req = urllib.request.Request(
                api_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                choice = (data.get("choices") or [{}])[0]
                msg = choice.get("message") or {}
                text_out = msg.get("content") or ""
                raw_tcs = msg.get("tool_calls") or []
                mock_tcs = []
                for idx, tc in enumerate(raw_tcs):
                    fn = tc.get("function") or {}
                    args_str = fn.get("arguments") or "{}"
                    try:
                        args_dict = json.loads(args_str) if isinstance(args_str, str) else args_str
                    except Exception:
                        args_dict = {"input": str(args_str)}
                    mock_tcs.append(
                        _ToolCallMock(
                            call_id=tc.get("id") or f"call_{idx}",
                            name=fn.get("name", ""),
                            arguments=args_dict,
                        )
                    )
                return _ResponseMock(content=text_out, tool_calls=mock_tcs)
        except Exception as e:
            print(f"[GeminiProvider] OpenAI/DeepSeek API lỗi ({e}), tự động chuyển sang Gemini fallback...")
            return None

    def _execute_with_retry(self, func, *args, **kwargs):
        max_Model_rounds = 2
        candidates = self._get_model_candidates()
        last_error = None

        for round_idx in range(max_Model_rounds):
            for model in candidates:
                keys_tried = 0
                max_keys = len(self.api_keys)

                while keys_tried < max_keys:
                    try:
                        return func(model, *args, **kwargs)
                    except Exception as e:
                        last_error = e
                        error_str = str(e)
                        is_quota_or_overload = any(
                            code in error_str
                            for code in [
                                "429",
                                "RESOURCE_EXHAUSTED",
                                "503",
                                "UNAVAILABLE",
                                "quota",
                                "rate",
                                "overloaded",
                                "403",
                                "PERMISSION_DENIED",
                            ]
                        )

                        if is_quota_or_overload:
                            keys_tried += 1
                            if keys_tried < max_keys and self._rotate_key():
                                time.sleep(0.3)
                                continue
                            else:
                                print(
                                    f"[GeminiProvider] Model '{model}' chạm giới hạn trên tất cả {max_keys} key. Chuyển sang model dự phòng..."
                                )
                                self._rotate_key()
                                break
                        else:
                            print(f"[GeminiProvider] Lỗi trên model '{model}': {error_str[:160]}")
                            break

            if round_idx < max_Model_rounds - 1:
                wait_time = 2 * (round_idx + 1)
                print(
                    f"[GeminiProvider] Tạm nghỉ {wait_time}s trước khi thử lại vòng #{round_idx + 2}..."
                )
                time.sleep(wait_time)

        if last_error is not None:
            raise last_error
        raise RuntimeError("Không thể thực thi yêu cầu tới Gemini API sau nhiều lần thử lại.")

    def generate_text(
        self, prompt: str, system_prompt: Optional[str] = None, temperature: float = 0.7
    ) -> str:
        config = types.GenerateContentConfig(temperature=temperature)
        if system_prompt:
            config.system_instruction = system_prompt

        def _call(model_to_use: str):
            response = self.client.models.generate_content(
                model=model_to_use,
                contents=prompt,
                config=config,
            )
            return response.text or ""

        return self._execute_with_retry(_call)

    def _prepare_request(
        self,
        messages: List[Any],
        temperature: float = 0.2,
        tools: Optional[List[Dict[str, Any]]] = None,
    ):
        system_instruction = None
        contents = []
        tool_result_count = 0

        for m in messages:
            content = (
                m.content
                if hasattr(m, "content")
                else (m.get("content", "") if isinstance(m, dict) else str(m))
            )
            role = (
                getattr(m, "role", None)
                or (m.get("role") if isinstance(m, dict) else None)
                or ""
            )
            cls_name = m.__class__.__name__

            if isinstance(m, SystemMessage) or role == "system" or cls_name == "SystemMessage":
                if system_instruction is None:
                    system_instruction = str(content)
                else:
                    system_instruction += f"\n{content}"
            elif isinstance(m, ToolMessage) or role == "tool" or cls_name == "ToolMessage":
                tool_result_count += 1
                contents.append(f"[Kết quả thực thi từ Công cụ #{tool_result_count}]: {content}")
            elif isinstance(m, AIMessage) or role == "assistant" or cls_name == "AIMessage":
                if content:
                    contents.append(f"[Phản hồi trước của Trợ lý]: {content}")
            else:
                if content:
                    contents.append(str(content))

        if not contents:
            contents = ["Xin chào, hãy bắt đầu nhiệm vụ."]

        # Ngăn vòng lặp vô tận sau 3 lần gọi tool liên tiếp
        if tool_result_count >= 3:
            tools = None
            contents.append(
                "HỆ THỐNG: Bạn đã có đầy đủ kết quả từ các lần gọi công cụ ở trên. "
                "Hãy tổng hợp và đưa ra câu trả lời cuối cùng cho người dùng ngay bây giờ."
            )

        config = types.GenerateContentConfig(temperature=temperature)
        if system_instruction:
            config.system_instruction = system_instruction

        if tools:
            func_declarations = []
            for t in tools:
                if isinstance(t, dict) and t.get("type") == "function":
                    f_info = t.get("function", {})
                    func_declarations.append(
                        types.FunctionDeclaration(
                            name=f_info.get("name"),
                            description=f_info.get("description"),
                            parameters=f_info.get("parameters"),
                        )
                    )
            if func_declarations:
                config.tools = [types.Tool(function_declarations=func_declarations)]

        return contents, config

    def chat_completion(
        self,
        messages: List[Any],
        temperature: float = 0.2,
        tools: Optional[List[Dict[str, Any]]] = None,
    ) -> Any:
        # 1. Thử gọi OpenAI/DeepSeek nếu model tương ứng và có API key
        ext_resp = self._try_openai_compatible_api(messages, temperature, tools)
        if ext_resp is not None:
            return ext_resp

        # 2. Gọi Google Gemini với cơ chế Retry + Key Rotation + Model Fallback
        contents, config = self._prepare_request(messages, temperature, tools)

        def _call(model_to_use: str):
            return self.client.models.generate_content(
                model=model_to_use,
                contents=contents,
                config=config,
            )

        response = self._execute_with_retry(_call)

        tool_calls = []
        if getattr(response, "function_calls", None):
            for idx, fc in enumerate(response.function_calls):
                args_dict = dict(fc.args) if fc.args else {}
                tool_calls.append(
                    _ToolCallMock(
                        call_id=f"call_{idx}_{fc.name}",
                        name=fc.name,
                        arguments=args_dict,
                    )
                )

        text_content = ""
        try:
            if not tool_calls and response.text:
                text_content = response.text
        except Exception:
            text_content = ""

        return _ResponseMock(content=text_content, tool_calls=tool_calls)

    def stream_chat_completion(
        self,
        messages: List[Any],
        temperature: float = 0.2,
        tools: Optional[List[Dict[str, Any]]] = None,
    ) -> Generator[str, None, None]:
        contents, config = self._prepare_request(messages, temperature, tools=None)

        def _call_stream(model_to_use: str):
            return self.client.models.generate_content_stream(
                model=model_to_use,
                contents=contents,
                config=config,
            )

        response_stream = self._execute_with_retry(_call_stream)

        for chunk in response_stream:
            try:
                if chunk.text:
                    yield chunk.text
            except Exception:
                pass
