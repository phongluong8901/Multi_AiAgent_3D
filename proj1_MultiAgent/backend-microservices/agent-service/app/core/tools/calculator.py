from typing import Dict, Any
from .base_tool import BaseTool
import json

class CalculatorTool(BaseTool):
    name = "calculator_tool"
    description = "Công cụ tính toán số học và xử lý biểu thức toán học cơ bản."

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            expression = arguments.get("expression", "0")
            # Thực thi tính toán an toàn
            result = eval(expression, {"__builtins__": {}}, {})
            return json.dumps({"success": True, "result": result})
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

# {
#   "tool_id": "calculator_tool",
#   "arguments": {
#     "expression": "125 * 8 + 50"
#   }
# }