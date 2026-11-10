import os
import json
import logging
from typing import Dict, Any, List
from .base_tool import BaseTool

logger = logging.getLogger(__name__)

class PythonCodeGeneratorTool(BaseTool):
    name = "python_code_generator_tool"
    description = (
        "Công cụ Lập trình & Tạo mã nguồn Python chuyên nghiệp (Code Generation): "
        "Sinh mã nguồn Python chuẩn mực PEP8, có type hints, docstring, xử lý ngoại lệ (try-except) "
        "và kèm theo ví dụ test chạy thử hoàn chỉnh. Sẵn sàng thực thi an toàn trong Sandbox."
    )

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            task = arguments.get("task") or arguments.get("prompt") or arguments.get("requirement") or arguments.get("description")
            if not task:
                return json.dumps({
                    "success": False,
                    "error": "Yêu cầu lập trình (task) không được để trống."
                }, ensure_ascii=False)

            libraries = arguments.get("libraries") or arguments.get("packages") or []
            style = arguments.get("style", "script")
            include_tests = arguments.get("include_tests", True)

            libs_str = ", ".join(libraries) if libraries else "Python Standard Library"

            if_main_text = 'BẮT BUỘC có khối `if __name__ == "__main__":` với dữ liệu mẫu để chạy thử và in kết quả ra màn hình.' if include_tests else ''
            instruction = (
                "Bạn là Kỹ sư phần mềm cao cấp (Principal Python Architect). "
                f"Nhiệm vụ: Viết mã nguồn Python giải quyết bài toán: '{task}'.\n\n"
                "QUY TẮC BẮT BUỘC:\n"
                "1. Code phải chuẩn mực PEP8, có Type Annotations rõ ràng, docstring giải thích tham số và kiểu trả về.\n"
                f"2. Sử dụng các thư viện: [{libs_str}].\n"
                "3. Có khối xử lý lỗi (try - except) bài bản.\n"
                f"4. {if_main_text}\n"
                "5. Trả về đúng định dạng JSON sau:\n"
                "{\n"
                "  \"language\": \"python\",\n"
                "  \"code\": \"# Toàn bộ mã nguồn Python hoàn chỉnh tại đây\",\n"
                "  \"explanation\": \"Giải thích ngắn gọn 2-3 câu về thuật toán và luồng xử lý\",\n"
                "  \"dependencies\": [\"tên các gói pip cần cài nếu có\"]\n"
                "}"
            )

            from google import genai
            from google.genai import types

            api_key = os.getenv("GOOGLE_API_KEY_MODEL", "")
            client = genai.Client(api_key=api_key) if api_key else genai.Client()

            code_models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
            last_err = None

            for c_model in code_models:
                try:
                    response = client.models.generate_content(
                        model=c_model,
                        contents=[instruction],
                        config=types.GenerateContentConfig(
                            temperature=0.2,
                            response_mime_type="application/json"
                        )
                    )

                    if response and response.text:
                        parsed = json.loads(response.text)
                        return json.dumps({
                            "success": True,
                            "model_used": c_model,
                            "generated": parsed
                        }, ensure_ascii=False)
                except Exception as ex:
                    last_err = ex
                    logger.warning(f"[PythonCodeGeneratorTool] Model {c_model} failed: {ex}. Retrying...")

            return json.dumps({
                "success": False,
                "error": f"Không thể tạo code qua LLM: {str(last_err)}"
            }, ensure_ascii=False)

        except Exception as e:
            logger.error(f"[PythonCodeGeneratorTool] Error: {str(e)}")
            return json.dumps({
                "success": False,
                "error": str(e)
            }, ensure_ascii=False)
