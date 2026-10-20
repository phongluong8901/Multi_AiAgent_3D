import json
from typing import Dict, Any
from app.core.tools.registry import tool_registry

class ToolExecutor:
    @staticmethod
    def execute(tool_id: str, arguments: Dict[str, Any]) -> str:
        """
        Thực thi logic của tool thông qua ToolRegistry để hỗ trợ động tất cả custom tools (Calculator, Web Crawler, v.v.).
        """
        print(f"[ToolExecutor] Executing tool '{tool_id}' with args: {arguments}")

        try:
            # Gọi trực tiếp qua registry để tự động điều phối đến đúng class tool tương ứng
            result_json_str = tool_registry.execute(tool_id, arguments)
            return result_json_str
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

tool_executor = ToolExecutor()