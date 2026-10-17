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
        # Đọc trực tiếp biến GOOGLE_API_KEY_MODEL của ông
        self.api_key = os.getenv("GOOGLE_API_KEY_MODEL", "")
        if self.api_key:
            os.environ["GEMINI_API_KEY"] = self.api_key

        # Khởi tạo client chính thức
        self.client = genai.Client()
        
        self.default_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        logger.info(f"[GeminiProvider] Khởi tạo thành công. Model: {self.default_model}")

    def chat_completion(self, messages, tools=None):
        try:
            system_instruction = None
            contents = []
            
            # Chuyển đổi định dạng messages sang cấu trúc Google GenAI
            for msg in messages:
                # Xử lý nếu message là object hoặc dict
                role = msg.get("role") if isinstance(msg, dict) else getattr(msg, "type", "user")
                content = msg.get("content", "") if isinstance(msg, dict) else getattr(msg, "content", "")
                
                if role == "system":
                    system_instruction = content
                elif role in ["user", "human"]:
                    contents.append(content)
                elif role in ["assistant", "ai"]:
                    contents.append(content)
                elif role == "tool":
                    contents.append(f"Tool Result: {content}")

            # Cấu hình config (System Instruction và Tools nếu có)
            config_kwargs = {}
            if system_instruction:
                config_kwargs["system_instruction"] = system_instruction

            # Chuyển đổi định dạng Tools sang Google GenAI Declarations nếu được truyền vào
            if tools:
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