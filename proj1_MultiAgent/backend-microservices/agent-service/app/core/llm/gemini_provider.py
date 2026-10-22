import os
import json
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
        logger.info(f"[GeminiProvider] Khởi tạo thành công. Model: {self.default_model}")

    def chat_completion(self, messages, tools=None):
        try:
            from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage

            system_instruction = None
            contents = []
            
            # Chuyển đổi định dạng messages sang cấu trúc Google GenAI
            has_tool_result = False
            for msg in messages:
                # --- Xác định role và content theo từng loại message ---
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
                    # Nếu AIMessage yêu cầu tool calls
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

            # Cấu hình config (System Instruction và Tools nếu có)
            config_kwargs = {}
            if system_instruction:
                config_kwargs["system_instruction"] = system_instruction

            # Nếu đã có kết quả tool trong lượt này, ta không cần ép khai báo tools nữa
            # để model tập trung tổng hợp câu trả lời cuối cùng (synthesis)
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

            logger.info(f"[GeminiProvider] Đang gọi model '{self.default_model}' qua Google GenAI SDK...")
            
            response = self.client.models.generate_content(
                model=self.default_model,
                contents=contents if contents else "Xin chào",
                config=config
            )

            # Trích xuất nội dung văn bản trả về
            text_content = response.text or ""
            
            # Xử lý nếu Model yêu cầu gọi Tool (Function Calling)
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

            # Đóng gói kết quả khớp chuẩn OpenAI response format để AgentRunner không cần sửa gì thêm
            message_mock = OpenAIMessageMock(content=text_content, tool_calls=tool_calls_mock)
            choice_mock = OpenAIChoiceMock(message=message_mock)
            return OpenAIResponseMock(choices=[choice_mock])

        except Exception as e:
            logger.error(f"[GeminiProvider] Lỗi khi gọi Google GenAI SDK: {e}")
            raise e