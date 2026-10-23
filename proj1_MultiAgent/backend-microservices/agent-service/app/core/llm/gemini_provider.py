import os
import json
import time
import logging
from google import genai
from google.genai import types
from .base_provider import BaseLLMProvider

logger = logging.getLogger(__name__)

# Các class mock cấu trúc phản hồi để tương thích hoàn toàn với code AgentRunner hiện tại
class OpenAIMessageMock:
    def __init__(self, content="", tool_calls=None):
        self.content = content
        self.tool_calls = tool_calls or []

class OpenAIChoiceMock:
    def __init__(self, message):
        self.message = message

class OpenAIResponseMock:
    def __init__(self, choices):
        self.choices = choices

class ToolCallMock:
    def __init__(self, id, name, arguments):
        self.id = id
        self.function = ToolFunctionMock(name, arguments)

class ToolFunctionMock:
    def __init__(self, name, arguments):
        self.name = name
        self.arguments = json.dumps(arguments) if isinstance(arguments, dict) else arguments


class GeminiProvider(BaseLLMProvider):
    # Danh sách các model Gemini dự phòng khi gặp lỗi 503 (Overloaded) hoặc 429 (Rate Limit)
    FALLBACK_MODELS = [
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
    ]

    def __init__(self):
        # Đọc trực tiếp biến GOOGLE_API_KEY_MODEL
        self.api_key = os.getenv("GOOGLE_API_KEY_MODEL", "")
        
        # Pass api_key trực tiếp vào Client để tránh SDK dùng nhầm GOOGLE_API_KEY env var
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = genai.Client()
            logger.warning("[GeminiProvider] GOOGLE_API_KEY_MODEL không được set!")
        
        self.default_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
        logger.info(f"[GeminiProvider] Khởi tạo thành công. Default Model: {self.default_model}")

    def chat_completion(self, messages, tools=None, agent_id=None, model=None, temperature=None):
        from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
        from app.core.agent_configs import get_agent_config

        # 1. Xác định cấu hình riêng của agent (nếu có agent_id)
        agent_cfg = get_agent_config(agent_id) if agent_id else {}
        preferred_model = model or agent_cfg.get("model") or self.default_model
        req_temperature = temperature if temperature is not None else agent_cfg.get("temperature", 0.3)

        system_instruction = None
        contents = []
        
        # 2. Chuyển đổi định dạng messages sang cấu trúc Google GenAI
        has_tool_result = False
        for msg in messages:
            if isinstance(msg, dict):
                role = msg.get("role", "user")
                content = msg.get("content", "")
            elif isinstance(msg, SystemMessage):
                role = "system"
                content = msg.content
            elif isinstance(msg, HumanMessage):
                role = "user"
                content = msg.content
            elif isinstance(msg, AIMessage):
                role = "assistant"
                content = msg.content or ""
                if hasattr(msg, "tool_calls") and msg.tool_calls:
                    tc_descs = []
                    for tc in msg.tool_calls:
                        tc_name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", "tool")
                        tc_args = tc.get("args") if isinstance(tc, dict) else getattr(tc, "args", {})
                        tc_descs.append(f"{tc_name}({json.dumps(tc_args, ensure_ascii=False)})")
                    content = f"[Đã gọi công cụ: {', '.join(tc_descs)}]"
            elif isinstance(msg, ToolMessage):
                role = "tool"
                content = msg.content
                has_tool_result = True
            else:
                class_name = type(msg).__name__.lower()
                if "system" in class_name:
                    role = "system"
                elif "tool" in class_name:
                    role = "tool"
                    has_tool_result = True
                elif "ai" in class_name or "assistant" in class_name:
                    role = "assistant"
                else:
                    role = "user"
                content = getattr(msg, "content", "") or ""

            if role == "system":
                system_instruction = content
            elif role in ["user", "human"]:
                if content:
                    contents.append(content)
            elif role in ["assistant", "ai"]:
                if content:
                    contents.append(f"Assistant: {content}")
            elif role == "tool":
                if content:
                    contents.append(
                        f"[Kết quả từ công cụ đã thực thi]: {content}\n"
                        "Yêu cầu: Hãy phân tích kỹ các thông tin/dữ liệu trên để trả lời đầy đủ, chi tiết, thân thiện và chính xác cho người dùng bằng tiếng Việt."
                    )

        # 3. Cấu hình config (System Instruction, Temperature và Tools nếu có)
        config_kwargs = {}
        if system_instruction:
            config_kwargs["system_instruction"] = system_instruction
        if req_temperature is not None:
            config_kwargs["temperature"] = float(req_temperature)

        if tools and not has_tool_result:
            function_declarations = []
            for tool in tools:
                func_data = tool.get("function", {})
                function_declarations.append(
                    types.FunctionDeclaration(
                        name=func_data.get("name"),
                        description=func_data.get("description"),
                        parameters=func_data.get("parameters")
                    )
                )
            if function_declarations:
                config_kwargs["tools"] = [types.Tool(function_declarations=function_declarations)]

        config = types.GenerateContentConfig(**config_kwargs)

        # 4. Tạo danh sách các model ứng viên để fallback nếu model chính gặp lỗi 503 / 429
        candidate_models = [preferred_model]
        for m in self.FALLBACK_MODELS:
            if m not in candidate_models:
                candidate_models.append(m)

        last_error = None
        for attempt_model in candidate_models:
            # Thử tối đa 2 lần cho mỗi model trước khi nhảy sang model fallback tiếp theo
            for retry in range(2):
                try:
                    logger.info(f"[GeminiProvider] Gọi model '{attempt_model}' (agent: {agent_id}, temp: {req_temperature})...")
                    response = self.client.models.generate_content(
                        model=attempt_model,
                        contents=contents if contents else "Xin chào",
                        config=config
                    )

                    text_content = response.text or ""
                    tool_calls_mock = []
                    if hasattr(response, "function_calls") and response.function_calls:
                        for idx, fc in enumerate(response.function_calls):
                            tool_calls_mock.append(
                                ToolCallMock(
                                    id=f"call_{idx}_{fc.name}",
                                    name=fc.name,
                                    arguments=fc.args if fc.args else {}
                                )
                            )

                    message_mock = OpenAIMessageMock(content=text_content, tool_calls=tool_calls_mock)
                    choice_mock = OpenAIChoiceMock(message=message_mock)
                    return OpenAIResponseMock(choices=[choice_mock])

                except Exception as e:
                    err_str = str(e)
                    last_error = e
                    is_overloaded_or_rate = (
                        "503" in err_str or
                        "429" in err_str or
                        "UNAVAILABLE" in err_str or
                        "high demand" in err_str or
                        "RESOURCE_EXHAUSTED" in err_str
                    )

                    if is_overloaded_or_rate:
                        logger.warn(f"[GeminiProvider] Model '{attempt_model}' bị quá tải (503/429), chờ thử lại ({retry + 1}/2)...")
                        time.sleep(1.5 * (retry + 1))
                    else:
                        # Nếu là lỗi khác (ví dụ tham số không hợp lệ), không retry model này nữa
                        break

            logger.warn(f"[GeminiProvider] Model '{attempt_model}' không phản hồi. Tự động chuyển sang model dự phòng tiếp theo trong danh sách...")

        logger.error(f"[GeminiProvider] Toàn bộ model dự phòng đều gặp sự cố: {last_error}")
        raise last_error