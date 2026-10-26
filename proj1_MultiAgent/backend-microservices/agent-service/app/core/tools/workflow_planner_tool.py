import json
from typing import Dict, Any, List
from .base_tool import BaseTool

class WorkflowPlannerTool(BaseTool):
    name = "workflow_planner_tool"
    description = "Công cụ lập kế hoạch và phân rã nhiệm vụ (Task Breakdown & Routing): chia nhỏ mục tiêu phức tạp thành các bước tuần tự và chỉ định agent chuyên trách phù hợp."

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            goal = arguments.get("goal") or arguments.get("task") or arguments.get("input") or ""
            if not goal:
                return json.dumps({
                    "success": False,
                    "error": "Mục tiêu bài toán không được để trống."
                }, ensure_ascii=False)

            goal_lower = str(goal).lower()
            plan_steps = []

            # 1. Phát hiện nhu cầu tìm kiếm
            needs_search = any(k in goal_lower for k in ["tìm", "tra cứu", "tin tức", "thông tin", "giá", "thị trường", "search", "web"])
            if needs_search:
                plan_steps.append({
                    "step": len(plan_steps) + 1,
                    "action": "Tra cứu và thu thập dữ liệu Internet mới nhất",
                    "assigned_agent": "@agent_search",
                    "tools": ["web_search_tool", "google_search_tool"]
                })

            # 2. Phát hiện nhu cầu tính toán
            needs_calc = any(k in goal_lower for k in ["tính", "toán", "cộng", "trừ", "nhân", "chia", "%", "lãi suất", "calculate", "math"])
            if needs_calc:
                plan_steps.append({
                    "step": len(plan_steps) + 1,
                    "action": "Tính toán công thức số học và số liệu chính xác",
                    "assigned_agent": "@agent_calculate",
                    "tools": ["calculator_tool"]
                })

            # 3. Phát hiện nhu cầu phân tích dữ liệu
            needs_analysis = any(k in goal_lower for k in ["phân tích", "thống kê", "so sánh", "xu hướng", "đánh giá dữ liệu", "analyst", "mean", "trend"])
            if needs_analysis:
                plan_steps.append({
                    "step": len(plan_steps) + 1,
                    "action": "Phân tích thống kê, xác định xu hướng và insights",
                    "assigned_agent": "@agent_analysis",
                    "tools": ["data_analysis_tool"]
                })

            # 4. Phát hiện nhu cầu Machine Learning / AI
            needs_ml = any(k in goal_lower for k in ["học máy", "mô hình", "ml", "ai", "f1", "precision", "accuracy", "train", "dự báo", "thuật toán"])
            if needs_ml:
                plan_steps.append({
                    "step": len(plan_steps) + 1,
                    "action": "Đánh giá chỉ số mô hình ML và gợi ý kiến trúc học máy tối ưu",
                    "assigned_agent": "@agent_ml",
                    "tools": ["ml_evaluator_tool"]
                })

            # 5. Luôn luôn có bước tổng hợp cuối cùng
            plan_steps.append({
                "step": len(plan_steps) + 1,
                "action": "Đúc kết toàn bộ kết quả thành báo cáo 3 phần súc tích gửi người dùng",
                "assigned_agent": "@agent_summarizer",
                "tools": ["summarizer_tool"]
            })

            return json.dumps({
                "success": True,
                "goal": goal,
                "total_steps": len(plan_steps),
                "plan": plan_steps,
                "recommendation": f"Hãy bắt đầu với bước 1 bằng cách gọi {plan_steps[0]['assigned_agent']}."
            }, ensure_ascii=False)

        except Exception as e:
            return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)
