import json
import math
from typing import Dict, Any, List
from .base_tool import BaseTool

class DataAnalysisTool(BaseTool):
    name = "data_analysis_tool"
    description = "Công cụ phân tích dữ liệu và thống kê mô tả: tính mean, median, min, max, độ lệch chuẩn (std), phân phối và phát hiện xu hướng (trend)."

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            raw_data = arguments.get("data") or arguments.get("numbers") or arguments.get("input")
            
            # Xử lý chuỗi nếu truyền dạng "1, 2, 3, 4" hoặc JSON string
            numbers: List[float] = []
            if isinstance(raw_data, str):
                try:
                    parsed = json.loads(raw_data)
                    if isinstance(parsed, list):
                        raw_data = parsed
                except Exception:
                    pass

            if isinstance(raw_data, list):
                for item in raw_data:
                    try:
                        numbers.append(float(item))
                    except (ValueError, TypeError):
                        continue
            elif isinstance(raw_data, str):
                import re
                found_numbers = re.findall(r"[-+]?\d*\.?\d+", raw_data)
                numbers = [float(n) for n in found_numbers]

            if not numbers:
                return json.dumps({
                    "success": False,
                    "error": "Không tìm thấy dữ liệu số hợp lệ để phân tích. Hãy truyền mảng số hoặc chuỗi số liệu."
                }, ensure_ascii=False)

            n = len(numbers)
            total = sum(numbers)
            mean = total / n
            sorted_nums = sorted(numbers)
            
            # Median
            if n % 2 == 1:
                median = sorted_nums[n // 2]
            else:
                median = (sorted_nums[n // 2 - 1] + sorted_nums[n // 2]) / 2.0

            # Variance & Std Dev
            variance = sum((x - mean) ** 2 for x in numbers) / (n - 1) if n > 1 else 0.0
            std_dev = math.sqrt(variance)

            # Xu hướng (trend) đơn giản
            trend = "stable"
            if n >= 3:
                first_half_avg = sum(numbers[:n // 2]) / (n // 2)
                second_half_avg = sum(numbers[n // 2:]) / (n - n // 2)
                if second_half_avg > first_half_avg * 1.05:
                    trend = "increasing (tăng trưởng)"
                elif second_half_avg < first_half_avg * 0.95:
                    trend = "decreasing (suy giảm)"
                else:
                    trend = "fluctuating / stable (dao động ổn định)"

            return json.dumps({
                "success": True,
                "count": n,
                "sum": round(total, 4),
                "mean": round(mean, 4),
                "median": round(median, 4),
                "min": min(numbers),
                "max": max(numbers),
                "range": round(max(numbers) - min(numbers), 4),
                "std_deviation": round(std_dev, 4),
                "trend": trend,
            }, ensure_ascii=False)

        except Exception as e:
            return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)
