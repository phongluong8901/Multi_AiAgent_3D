import json
from typing import Dict, Any, List
from .base_tool import BaseTool


class WorkflowPlannerTool(BaseTool):
    name = "workflow_planner_tool"
    description = (
        "Công cụ lập kế hoạch và phân rã nhiệm vụ (Task Breakdown & Multi-Agent Routing): "
        "chia nhỏ mục tiêu phức tạp thành các bước tuần tự và chỉ định agent cùng bộ công cụ chuyên trách."
    )

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            goal = arguments.get("goal") or arguments.get("task") or arguments.get("input") or ""
            if not goal:
                return json.dumps(
                    {
                        "success": False,
                        "error": "Mục tiêu bài toán không được để trống.",
                    },
                    ensure_ascii=False,
                )

            goal_lower = str(goal).lower()
            plan_steps: List[Dict[str, Any]] = []

            # 1. Phát hiện nhu cầu tìm kiếm
            needs_search = any(
                k in goal_lower
                for k in ["tìm", "tra cứu", "tin tức", "thông tin", "thị trường", "search", "web", "mới nhất"]
            )
            if needs_search:
                plan_steps.append(
                    {
                        "step": len(plan_steps) + 1,
                        "action": "Tra cứu và thu thập dữ liệu Internet / tài liệu mới nhất",
                        "assigned_agent": "@agent_search",
                        "tools": ["web_search_tool", "google_search_tool", "wikipedia_tool"],
                    }
                )

            # 2. Phát hiện nhu cầu tính toán & tài chính đầu tư
            needs_calc = any(
                k in goal_lower
                for k in [
                    "tính", "toán", "cộng", "trừ", "nhân", "chia", "%",
                    "lãi suất", "lãi kép", "roi", "npv", "cagr", "vốn", "đầu tư", "tỷ giá",
                    "calculate", "math", "finance",
                ]
            )
            if needs_calc:
                plan_steps.append(
                    {
                        "step": len(plan_steps) + 1,
                        "action": "Tính toán biểu thức toán học, chỉ số tài chính (ROI, NPV, CAGR, lãi kép)",
                        "assigned_agent": "@agent_calculate",
                        "tools": ["calculator_tool", "financial_market_tool"],
                    }
                )

            # 3. Phát hiện nhu cầu phân tích dữ liệu, JSON/CSV, cảm xúc
            needs_analysis = any(
                k in goal_lower
                for k in [
                    "phân tích", "thống kê", "so sánh", "xu hướng", "đánh giá dữ liệu",
                    "analyst", "mean", "trend", "csv", "json", "cảm xúc", "sentiment",
                ]
            )
            if needs_analysis:
                plan_steps.append(
                    {
                        "step": len(plan_steps) + 1,
                        "action": "Phân tích thống kê, xử lý CSV/JSON, đánh giá xu hướng và sắc thái cảm xúc",
                        "assigned_agent": "@agent_analysis",
                        "tools": [
                            "data_analysis_tool",
                            "csv_analyzer_tool",
                            "json_data_transformer_tool",
                            "sentiment_analysis_tool",
                        ],
                    }
                )

            # 4. Phát hiện nhu cầu Machine Learning / AI / RL
            needs_ml = any(
                k in goal_lower
                for k in [
                    "học máy", "mô hình", "ml", "ai", "f1", "precision", "accuracy",
                    "train", "dự báo", "thuật toán", "reinforcement", "rl",
                ]
            )
            if needs_ml:
                plan_steps.append(
                    {
                        "step": len(plan_steps) + 1,
                        "action": "Đánh giá chỉ số mô hình ML/RL và gợi ý kiến trúc học máy tối ưu",
                        "assigned_agent": "@agent_ml",
                        "tools": ["ml_evaluator_tool", "data_analysis_tool"],
                    }
                )

            # 5. Phát hiện nhu cầu Thị giác máy tính & OCR ảnh
            needs_vision = any(
                k in goal_lower
                for k in ["ảnh", "hình ảnh", "image", "ocr", "quét chữ", "hóa đơn", "nhận diện ảnh", "photo"]
            )
            if needs_vision:
                plan_steps.append(
                    {
                        "step": len(plan_steps) + 1,
                        "action": "Nhận diện vật thể, phân loại hình ảnh và trích xuất chữ OCR",
                        "assigned_agent": "@agent_vision",
                        "tools": ["image_analyzer_tool"],
                    }
                )

            # 6. Phát hiện nhu cầu Lập trình Python, SQL, Kiểm toán Bảo mật & Sandbox
            needs_coding = any(
                k in goal_lower
                for k in [
                    "code", "lập trình", "python", "viết hàm", "script", "chạy code",
                    "sandbox", "sql", "database", "query", "bảo mật", "security", "audit",
                ]
            )
            if needs_coding:
                plan_steps.append(
                    {
                        "step": len(plan_steps) + 1,
                        "action": "Sinh mã nguồn Python/SQL, kiểm toán bảo mật mã nguồn và thực thi trong Sandbox",
                        "assigned_agent": "@agent_coder",
                        "tools": [
                            "python_code_generator_tool",
                            "python_sandbox_tool",
                            "sql_query_generator_tool",
                            "security_code_auditor_tool",
                        ],
                    }
                )

            # 7. Phát hiện nhu cầu tóm tắt văn bản dài chuyên sâu
            needs_summary_agent = any(
                k in goal_lower
                for k in ["tài liệu dài", "văn bản", "hợp đồng", "bài báo", "sách", "pdf", "tổng hợp nhiều nguồn", "tóm tắt"]
            )
            if needs_summary_agent:
                plan_steps.append(
                    {
                        "step": len(plan_steps) + 1,
                        "action": "Cô đọng văn bản dài, trích xuất ý chính và phân tích cảm xúc",
                        "assigned_agent": "@agent_summarizer",
                        "tools": ["summarizer_tool", "sentiment_analysis_tool"],
                    }
                )

            # 8. Phát hiện nhu cầu kiểm tra sức khỏe hệ thống / cụm node phân tán
            needs_sys = any(
                k in goal_lower
                for k in ["hệ thống", "cluster", "node", "worker", "health", "trạng thái server", "microservice"]
            )
            if needs_sys:
                plan_steps.append(
                    {
                        "step": len(plan_steps) + 1,
                        "action": "Kiểm tra sức khỏe cụm Microservices, Distributed Worker và tài nguyên hệ thống",
                        "assigned_agent": "@agent_manager",
                        "tools": ["system_health_tool"],
                    }
                )

            # Nếu chưa có bước nào được chọn, mặc định tra cứu tìm kiếm
            if not plan_steps:
                plan_steps.append(
                    {
                        "step": 1,
                        "action": "Tra cứu và thu thập thông tin liên quan",
                        "assigned_agent": "@agent_search",
                        "tools": ["web_search_tool"],
                    }
                )

            # Bước chốt hạ CUỐI CÙNG LUÔN LÀ: Trưởng nhóm Manager phản hồi trực tiếp cho người dùng
            plan_steps.append(
                {
                    "step": len(plan_steps) + 1,
                    "action": "Trưởng nhóm @agent_manager đối chiếu yêu cầu ban đầu, đúc kết ngắn gọn và trực tiếp trả lời kết quả cho người dùng",
                    "assigned_agent": "@agent_manager",
                    "tools": [],
                }
            )

            first_worker = plan_steps[0]["assigned_agent"]
            rec = (
                f"Hãy giao việc cho {first_worker}. "
                f"Yêu cầu {first_worker} sau khi hoàn thành phần việc phải báo cáo kết quả lại cho bạn (@agent_manager) "
                f"để bạn tổng kết, chắt lọc ngắn gọn và trực tiếp trả lời kết quả cuối cùng cho người dùng."
            )

            return json.dumps(
                {
                    "success": True,
                    "goal": goal,
                    "total_steps": len(plan_steps),
                    "plan": plan_steps,
                    "recommendation": rec,
                },
                ensure_ascii=False,
            )

        except Exception as e:
            return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)
