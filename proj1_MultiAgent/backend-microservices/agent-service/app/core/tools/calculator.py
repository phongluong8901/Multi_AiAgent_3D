import json
import math
import statistics
from typing import Dict, Any
from .base_tool import BaseTool


class CalculatorTool(BaseTool):
    name = "calculator_tool"
    description = (
        "Công cụ tính toán toán học, đại số, lượng giác, logarit và thống kê nâng cao "
        "(hỗ trợ +, -, *, /, **, sqrt, sin, cos, tan, log, log10, exp, pi, e, abs, round, min, max, sum, mean, stdev)."
    )

    SAFE_NAMESPACE = {
        "__builtins__": {},
        # Hằng số toán học
        "pi": math.pi,
        "e": math.e,
        "inf": math.inf,
        # Hàm toán học chuẩn
        "sqrt": math.sqrt,
        "pow": math.pow,
        "abs": abs,
        "round": round,
        "min": min,
        "max": max,
        "sum": sum,
        "len": len,
        "sin": math.sin,
        "cos": math.cos,
        "tan": math.tan,
        "asin": math.asin,
        "acos": math.acos,
        "atan": math.atan,
        "degrees": math.degrees,
        "radians": math.radians,
        "log": math.log,
        "ln": math.log,
        "log10": math.log10,
        "log2": math.log2,
        "exp": math.exp,
        "ceil": math.ceil,
        "floor": math.floor,
        "factorial": math.factorial,
        "gcd": math.gcd,
        # Hàm thống kê nhanh
        "mean": statistics.mean,
        "median": statistics.median,
        "stdev": lambda x: statistics.stdev(x) if len(x) > 1 else 0.0,
        "variance": lambda x: statistics.variance(x) if len(x) > 1 else 0.0,
    }

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            if isinstance(arguments, str):
                expression = arguments
            elif isinstance(arguments, dict):
                expression = (
                    arguments.get("expression")
                    or arguments.get("input")
                    or arguments.get("calc")
                    or arguments.get("formula")
                    or "0"
                )
            else:
                expression = str(arguments) if arguments else "0"

            clean_expr = str(expression).strip()
            # Chuẩn hóa ký hiệu toán học phổ biến
            clean_expr = clean_expr.replace("^", "**").replace("×", "*").replace("÷", "/")

            result = eval(clean_expr, {"__builtins__": {}}, self.SAFE_NAMESPACE)
            if isinstance(result, float):
                rounded = round(result, 8)
            else:
                rounded = result

            return json.dumps(
                {
                    "success": True,
                    "expression": clean_expr,
                    "result": rounded,
                    "formatted": f"{rounded:,}" if isinstance(rounded, (int, float)) else str(rounded),
                },
                ensure_ascii=False,
            )
        except Exception as e:
            return json.dumps(
                {
                    "success": False,
                    "expression": str(arguments),
                    "error": f"Lỗi tính toán biểu thức: {str(e)}",
                },
                ensure_ascii=False,
            )
