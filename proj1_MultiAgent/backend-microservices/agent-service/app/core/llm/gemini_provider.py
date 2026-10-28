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

    def _prepare_request(self, messages, tools=None, agent_id=None, model=None, temperature=None):
        from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
        from app.core.agent_configs import get_agent_config

        agent_cfg = get_agent_config(agent_id) if agent_id else {}
        preferred_model = model or agent_cfg.get("model") or self.default_model
        req_temperature = temperature if temperature is not None else agent_cfg.get("temperature", 0.3)

        system_instruction = None
        contents = []

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
            else:
                class_name = type(msg).__name__.lower()
                if "system" in class_name:
                    role = "system"
                elif "tool" in class_name:
                    role = "tool"
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
                        f"[Kết quả từ công cụ đã thực thi]:\n{content}\n"
                        "Ghi chú cho AI: Bạn có thể tiếp tục gọi công cụ kế tiếp (ví dụ: công cụ trực quan hóa 'data_visualization_tool' nếu cần vẽ biểu đồ/đồ thị xu hướng giá cả hoặc số liệu, hoặc công cụ tóm tắt 'text_summarizer' nếu nội dung dài, hoặc công cụ phân tích/tính toán) nếu cần thiết. "
                        "Nếu đã thu thập đủ dữ liệu và hoàn thành nhiệm vụ, hãy tổng hợp câu trả lời chi tiết, dễ hiểu, thẩm mỹ bằng tiếng Việt."
                    )

        tool_result_count = sum(1 for m in messages if isinstance(m, ToolMessage) or getattr(m, "role", "") == "tool")
        allow_more_tools = tool_result_count < 5

        config_kwargs = {}
        if system_instruction:
            config_kwargs["system_instruction"] = system_instruction
        if req_temperature is not None:
            config_kwargs["temperature"] = float(req_temperature)

        if tools and allow_more_tools:
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

        candidate_models = [preferred_model]
        for m in self.FALLBACK_MODELS:
            if m not in candidate_models:
                candidate_models.append(m)

        return contents, config, preferred_model, candidate_models, tool_result_count, req_temperature

    @staticmethod
    def _is_local_or_rented_model(model_name: str | None) -> bool:
        if not model_name:
            return False
        m = str(model_name).lower()
        return (
            m.startswith("rental:")
            or m.startswith("local:")
            or m.startswith("ollama:")
            or "qwen" in m
            or "deepseek" in m
            or "llama" in m
            or "phi" in m
            or "mistral" in m
        )

    def chat_completion(self, messages, tools=None, agent_id=None, model=None, temperature=None):
        if self._is_local_or_rented_model(model):
            from .ollama_provider import OllamaProvider
            logger.info(f"[GeminiProvider -> OllamaProvider] Định tuyến model '{model}' của agent '{agent_id}' sang Local LLM / Seller Node...")
            return OllamaProvider().chat_completion(
                messages=messages,
                tools=tools,
                agent_id=agent_id,
                model=model,
                temperature=temperature,
            )

        contents, config, preferred_model, candidate_models, tool_result_count, req_temperature = self._prepare_request(
            messages, tools=tools, agent_id=agent_id, model=model, temperature=temperature
        )

        last_error = None
        for attempt_model in candidate_models:
            for retry in range(2):
                try:
                    logger.info(f"[GeminiProvider] Gọi model '{attempt_model}' (agent: {agent_id}, temp: {req_temperature}, tool_step: {tool_result_count})...")
                    response = self.client.models.generate_content(
                        model=attempt_model,
                        contents=contents if contents else "Xin chào",
                        config=config
                    )

                    # Trích xuất text content và tool calls an toàn từ candidate parts
                    text_parts = []
                    tool_calls_mock = []
                    
                    if hasattr(response, "candidates") and response.candidates:
                        for cand in response.candidates:
                            if hasattr(cand, "content") and cand.content and hasattr(cand.content, "parts"):
                                for part in cand.content.parts:
                                    if hasattr(part, "text") and part.text:
                                        text_parts.append(part.text)
                                    if hasattr(part, "function_call") and part.function_call:
                                        fc = part.function_call
                                        tool_calls_mock.append(
                                            ToolCallMock(
                                                id=f"call_{len(tool_calls_mock)}_{fc.name}",
                                                name=fc.name,
                                                arguments=dict(fc.args) if hasattr(fc, "args") and fc.args else {}
                                            )
                                        )

                    if not tool_calls_mock and hasattr(response, "function_calls") and response.function_calls:
                        for idx, fc in enumerate(response.function_calls):
                            tool_calls_mock.append(
                                ToolCallMock(
                                    id=f"call_{idx}_{fc.name}",
                                    name=fc.name,
                                    arguments=dict(fc.args) if hasattr(fc, "args") and fc.args else {}
                                )
                            )

                    text_content = "".join(text_parts) if text_parts else (getattr(response, "text", "") or "")
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
                        break

            logger.warn(f"[GeminiProvider] Model '{attempt_model}' không phản hồi. Tự động chuyển sang model dự phòng tiếp theo trong danh sách...")

        logger.error(f"[GeminiProvider] Toàn bộ model dự phòng đều gặp sự cố: {last_error}")
        if last_error is not None:
            raise last_error
        raise RuntimeError("Toàn bộ model dự phòng đều gặp sự cố nhưng không bắt được lỗi cụ thể.")

    def stream_chat_completion(self, messages, tools=None, agent_id=None, model=None, temperature=None):
        """
        Stream tokens và tool calls từ Gemini API theo thời gian thực.
        """
        if self._is_local_or_rented_model(model):
            from .ollama_provider import OllamaProvider
            logger.info(f"[GeminiProvider -> OllamaProvider] Stream model '{model}' của agent '{agent_id}' qua Local LLM / Seller Node...")
            yield from OllamaProvider().stream_chat_completion(
                messages=messages,
                tools=tools,
                agent_id=agent_id,
                model=model,
                temperature=temperature,
            )
            return

        contents, config, preferred_model, candidate_models, tool_result_count, req_temperature = self._prepare_request(
            messages, tools=tools, agent_id=agent_id, model=model, temperature=temperature
        )

        last_error = None
        for attempt_model in candidate_models:
            for retry in range(2):
                try:
                    logger.info(f"[GeminiProvider] Stream model '{attempt_model}' (agent: {agent_id}, temp: {req_temperature})...")
                    stream = self.client.models.generate_content_stream(
                        model=attempt_model,
                        contents=contents if contents else "Xin chào",
                        config=config
                    )

                    accumulated_tool_calls = []
                    has_yielded_token = False

                    for chunk in stream:
                        # Trích xuất function calls từ candidates parts
                        if hasattr(chunk, "candidates") and chunk.candidates:
                            for cand in chunk.candidates:
                                if hasattr(cand, "content") and cand.content and hasattr(cand.content, "parts"):
                                    for part in cand.content.parts:
                                        if hasattr(part, "function_call") and part.function_call:
                                            fc = part.function_call
                                            accumulated_tool_calls.append(
                                                ToolCallMock(
                                                    id=f"call_{len(accumulated_tool_calls)}_{fc.name}",
                                                    name=fc.name,
                                                    arguments=dict(fc.args) if hasattr(fc, "args") and fc.args else {}
                                                )
                                            )
                                        if hasattr(part, "text") and part.text:
                                            has_yielded_token = True
                                            yield {"type": "token", "content": part.text}

                        if not accumulated_tool_calls and hasattr(chunk, "function_calls") and chunk.function_calls:
                            for idx, fc in enumerate(chunk.function_calls):
                                accumulated_tool_calls.append(
                                    ToolCallMock(
                                        id=f"call_{idx}_{fc.name}",
                                        name=fc.name,
                                        arguments=dict(fc.args) if hasattr(fc, "args") and fc.args else {}
                                    )
                                )

                        text = getattr(chunk, "text", "") or ""
                        if text and not has_yielded_token:
                            has_yielded_token = True
                            yield {"type": "token", "content": text}

                    if accumulated_tool_calls:
                        yield {"type": "tool_calls", "tool_calls": accumulated_tool_calls}
                    return

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
                        logger.warn(f"[GeminiProvider] Stream model '{attempt_model}' bị quá tải, chờ thử lại...")
                        time.sleep(1.5 * (retry + 1))
                    else:
                        break

            logger.warn(f"[GeminiProvider] Model '{attempt_model}' stream gặp lỗi. Chuyển fallback...")

        logger.error(f"[GeminiProvider] Toàn bộ model dự phòng stream đều gặp sự cố: {last_error}")
        if last_error is not None:
            raise last_error
        raise RuntimeError("Toàn bộ model dự phòng stream đều gặp sự cố nhưng không bắt được lỗi cụ thể.")