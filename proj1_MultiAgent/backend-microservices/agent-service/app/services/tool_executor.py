import json
import traceback
import os
import re
import math
import urllib.request
import requests
import datetime
from typing import Dict, Any, Optional
from app.core.tools.registry import tool_registry

class ToolExecutor:
    @staticmethod
    def execute_custom_code(
        code: str,
        arguments: Dict[str, Any],
        env_vars: Optional[Any] = None
    ) -> str:
        """
        Thực thi mã nguồn Python do người dùng nhập từ giao diện UI Web một cách an toàn và trả về kết quả JSON.
        Tự động nạp các API Keys / biến môi trường cấu hình cho tool vào os.environ và scope['secrets'].
        """
        if not code or not code.strip():
            return json.dumps({"success": False, "error": "Mã nguồn Python không được để trống."})

        # Xử lý nạp các biến môi trường và API Keys
        parsed_env: Dict[str, str] = {}
        if isinstance(env_vars, dict):
            parsed_env = {str(k).strip(): str(v).strip() for k, v in env_vars.items() if k}
        elif isinstance(env_vars, str) and env_vars.strip():
            try:
                raw_dict = json.loads(env_vars)
                if isinstance(raw_dict, dict):
                    parsed_env = {str(k).strip(): str(v).strip() for k, v in raw_dict.items() if k}
            except Exception:
                pass

        # Cập nhật vào os.environ để các hàm os.getenv("API_KEY") hoạt động tự nhiên
        for k, v in parsed_env.items():
            os.environ[k] = v

        # Môi trường chạy với các thư viện thông dụng sẵn có
        scope: Dict[str, Any] = {
            "__builtins__": __builtins__,
            "os": os,
            "json": json,
            "re": re,
            "math": math,
            "urllib": urllib,
            "requests": requests,
            "datetime": datetime,
            "secrets": parsed_env,
            "env": parsed_env,
            "Dict": Dict,
            "Any": Any,
        }

        try:
            # Biên dịch và nạp mã nguồn vào cùng 1 scope
            exec(code, scope)

            # Trường hợp 1: Người dùng viết hàm execute(arguments)
            if "execute" in scope and callable(scope["execute"]):
                output = scope["execute"](arguments)
                if isinstance(output, str):
                    return output
                return json.dumps(output, ensure_ascii=False)

            # Trường hợp 2: Người dùng định nghĩa class có method execute(self, arguments)
            for item in list(scope.values()):
                if isinstance(item, type) and hasattr(item, "execute") and item.__module__ in ["builtins", "__main__", None]:
                    instance = item()
                    output = instance.execute(arguments)
                    if isinstance(output, str):
                        return output
                    return json.dumps(output, ensure_ascii=False)

            return json.dumps({
                "success": False,
                "error": "Mã nguồn cần định nghĩa hàm 'def execute(arguments):' hoặc class kế thừa BaseTool có phương thức execute."
            })
        except Exception as e:
            return json.dumps({
                "success": False,
                "error": f"Lỗi thực thi mã Python: {str(e)}",
                "traceback": traceback.format_exc()
            })

    @classmethod
    def execute(cls, tool_id: str, arguments: Dict[str, Any], tool_obj: Optional[Any] = None) -> str:
        """
        Thực thi logic của tool thông qua code tuỳ chỉnh nếu có, hoặc chuyển tiếp tới ToolRegistry.
        """
        print(f"[ToolExecutor] Executing tool '{tool_id}' with args: {arguments}")

        try:
            # 1. Nếu tool có custom code lưu trong database, chạy code tuỳ chỉnh kèm API Keys / env_vars
            if tool_obj and getattr(tool_obj, "code", None):
                env_data = getattr(tool_obj, "env_vars", None)
                return cls.execute_custom_code(tool_obj.code, arguments, env_vars=env_data)

            # 2. Xử lý đồng bộ alias cho summarizer
            if tool_id in ["summarizer_tool", "text_summarizer"]:
                # Nếu tool_registry có đăng ký summarizer
                res = tool_registry.execute("text_summarizer", arguments)
                if "not found" not in res:
                    return res
                # Fallback bộ tóm tắt thông minh tích hợp sẵn
                from app.core.tools.text_summarizer import summarize_text_smart
                text_input = arguments.get("text", "") or arguments.get("input", "")
                max_len = arguments.get("max_length", 150)
                return summarize_text_smart(text_input, max_len)

            # 3. Gọi các tool hệ thống đã đăng ký (Calculator, Web Search, Web Crawler,...)
            result_json_str = tool_registry.execute(tool_id, arguments)
            return result_json_str
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

tool_executor = ToolExecutor()