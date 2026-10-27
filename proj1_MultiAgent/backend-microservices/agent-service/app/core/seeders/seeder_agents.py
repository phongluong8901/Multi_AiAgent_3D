from sqlalchemy.orm import Session
from app.models.agent import AgentModel
from app.models.tool import ToolModel

def seed_agents(db: Session):
    try:
        default_agents = [
            # 1. MANAGER
            {
                "id": "agent_manager",
                "name": "Manager Lead",
                "color": "#facc15",
                "status": "idle",
                "speech": "Xin chào! Tôi là Manager phụ trách lập kế hoạch và điều phối các AI Agent trong hệ thống.",
                "pos_x": -9.5,
                "pos_y": 1.0,
                "pos_z": -8.0,
                "model": "gemini-2.5-flash",
                "prompt_id": "manager",
                "tool_ids": ["workflow_planner_tool", "system_control_tool"]
            },

            # 2. SEARCH
            {
                "id": "agent_search",
                "name": "Search Researcher",
                "color": "#38bdf8",
                "status": "idle",
                "speech": "Sẵn sàng thu thập, tra cứu tin tức và trích xuất dữ liệu Internet chuyên sâu.",
                "pos_x": 5.5,
                "pos_y": 1.0,
                "pos_z": -8.0,
                "model": "gemini-2.5-flash-lite",
                "prompt_id": "chuyen_gia_tim_kiem",
                "tool_ids": ["web_search_tool", "google_search_tool", "web_crawler_tool"]
            },

            # 3. SUMMARY
            {
                "id": "agent_summarizer",
                "name": "Summarizer Pro",
                "color": "#e53e3e",
                "status": "idle",
                "speech": "Tôi đúc kết toàn bộ ngữ cảnh thành báo cáo 3 phần súc tích và mạch lạc.",
                "pos_x": 0.0,
                "pos_y": 1.0,
                "pos_z": -2.0,
                "model": "gemini-2.5-flash-lite",
                "prompt_id": "chuyen_gia_tom_tat",
                "tool_ids": ["summarizer_tool", "text_summarizer"]
            },

            # 4. CALCULATE
            {
                "id": "agent_calculate",
                "name": "Calculator Pro",
                "color": "#9333ea",
                "status": "idle",
                "speech": "Tôi chuyên xử lý các phép toán số học, tài chính và công thức chính xác 100%.",
                "pos_x": 3.0,
                "pos_y": 1.0,
                "pos_z": 2.0,
                "model": "gemini-2.5-flash-lite",
                "prompt_id": "chuyen_gia_tinh_toan",
                "tool_ids": ["calculator_tool"]
            },

            # 5. ANALYSIS
            {
                "id": "agent_analysis",
                "name": "Data Analyst",
                "color": "#f97316",
                "status": "idle",
                "speech": "Tôi phân tích thống kê mô tả, tính toán độ lệch chuẩn và phát hiện xu hướng dữ liệu.",
                "pos_x": -2.0,
                "pos_y": 1.0,
                "pos_z": 0.0,
                "model": "gemini-2.5-flash",
                "prompt_id": "chuyen_gia_phan_tich",
                "tool_ids": ["data_analysis_tool", "csv_analyzer_tool", "data_visualization_tool", "db_query_tool"]
            },
            {
                "id": "agent_analyst",
                "name": "Data Analyst",
                "color": "#f97316",
                "status": "idle",
                "speech": "Chuyên gia phân tích dữ liệu, cấu trúc file CSV và trực quan hóa số liệu.",
                "pos_x": -3.0,
                "pos_y": 1.0,
                "pos_z": 0.0,
                "model": "gemini-2.5-flash",
                "prompt_id": "chuyen_gia_phan_tich",
                "tool_ids": ["data_analysis_tool", "csv_analyzer_tool", "data_visualization_tool", "db_query_tool"]
            },

            # 6. MACHINE LEARNING
            {
                "id": "agent_ml",
                "name": "ML Scientist",
                "color": "#10b981",
                "status": "idle",
                "speech": "Chuyên gia Machine Learning & AI, đánh giá metrics mô hình và gợi ý kiến trúc tối ưu.",
                "pos_x": 2.0,
                "pos_y": 1.0,
                "pos_z": 0.0,
                "model": "gemini-2.5-flash",
                "prompt_id": "chuyen_gia_ml",
                "tool_ids": ["ml_evaluator_tool", "calculator_tool", "python_sandbox_tool"]
            },

            # 7. DATA VISUALIZATION
            {
                "id": "agent_visualize",
                "name": "Data Visualizer",
                "color": "#ec4899",
                "status": "idle",
                "speech": "Chuyên gia trực quan hóa dữ liệu, biến số liệu phức tạp thành biểu đồ trực quan sống động.",
                "pos_x": -1.0,
                "pos_y": 1.0,
                "pos_z": 2.0,
                "model": "gemini-2.5-flash",
                "prompt_id": "chuyen_gia_truc_quan",
                "tool_ids": ["data_visualization_tool", "data_analysis_tool"]
            },

            # 8. COMPUTER VISION & OCR
            {
                "id": "agent_vision",
                "name": "Vision Expert",
                "color": "#06b6d4",
                "status": "idle",
                "speech": "Chuyên gia thị giác máy tính: nhận diện đối tượng, phân loại ảnh và trích xuất chữ OCR chuẩn xác.",
                "pos_x": 4.0,
                "pos_y": 1.0,
                "pos_z": -3.0,
                "model": "gemini-2.5-flash",
                "prompt_id": "chuyen_gia_thi_giac",
                "tool_ids": ["image_analyzer_tool", "web_search_tool"]
            },

            # 9. PYTHON CODER & SANDBOX RUNNER
            {
                "id": "agent_coder",
                "name": "Python Coder",
                "color": "#14b8a6",
                "status": "idle",
                "speech": "Kỹ sư phần mềm: sinh mã Python chuẩn mực và thực thi an toàn trong Container Sandbox cô lập.",
                "pos_x": -5.0,
                "pos_y": 1.0,
                "pos_z": -2.0,
                "model": "gemini-2.5-flash",
                "prompt_id": "chuyen_gia_lap_trinh",
                "tool_ids": ["python_code_generator_tool", "python_sandbox_tool", "calculator_tool"]
            }
        ]

        for agent_data in default_agents:
            tool_ids = agent_data.pop("tool_ids", [])
            tools = db.query(ToolModel).filter(ToolModel.id.in_(tool_ids)).all() if tool_ids else []

            existing = db.query(AgentModel).filter(AgentModel.id == agent_data["id"]).first()
            if not existing:
                new_agent = AgentModel(**agent_data)
                new_agent.tools = tools
                db.add(new_agent)
                print(f"[AgentSeeder] Added default agent: {agent_data['name']}")
            else:
                # Cập nhật thông tin mới nhất
                existing.name = agent_data["name"]
                existing.prompt_id = agent_data["prompt_id"]
                if hasattr(existing, "model") and "model" in agent_data:
                    existing.model = agent_data["model"]
                existing.tools = tools
                print(f"[AgentSeeder] Updated default agent: {agent_data['name']}")

        db.commit()
        print("[AgentSeeder] Default agents seeded successfully.")
    except Exception as e:
        db.rollback()
        print(f"[AgentSeeder] Error seeding agents: {str(e)}")