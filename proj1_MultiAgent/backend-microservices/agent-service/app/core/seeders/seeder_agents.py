from sqlalchemy.orm import Session
from app.models.agent import AgentModel
from app.models.tool import ToolModel

def seed_agents(db: Session):
    try:
        default_agents = [
            {
                "id": "agent_manager",
                "name": "Manager Agent",
                "color": "#3182ce",
                "status": "idle",
                "speech": "Xin chào! Tôi là Manager điều phối hệ thống 3D.",
                "pos_x": 0.0,
                "pos_y": 1.0,
                "pos_z": 0.0,
                "prompt_id": "manager",
                "tool_ids": ["system_control_tool"]
            },
            {
                "id": "agent_ml",
                "name": "ML Expert",
                "color": "#38a169",
                "status": "idle",
                "speech": "Xin chào! Tôi là Chuyên gia Machine Learning.",
                "pos_x": 2.0,
                "pos_y": 1.0,
                "pos_z": 0.0,
                "prompt_id": "chuyen_gia_ml",
                "tool_ids": ["calculator_tool"]
            },
            {
                "id": "agent_analyst",
                "name": "Data Analyst",
                "color": "#d69e2e",
                "status": "idle",
                "speech": "Xin chào! Tôi chuyên phân tích hệ thống và dữ liệu.",
                "pos_x": -2.0,
                "pos_y": 1.0,
                "pos_z": 0.0,
                "prompt_id": "chuyen_gia_phan_tich",
                "tool_ids": ["db_query_tool"]
            },
            {
                "id": "agent_search",
                "name": "Search Expert",
                "color": "#805ad5",
                "status": "idle",
                "speech": "Xin chào! Tôi sẵn sàng tra cứu thông tin và tài liệu.",
                "pos_x": 0.0,
                "pos_y": 1.0,
                "pos_z": 2.0,
                "prompt_id": "chuyen_gia_tim_kiem",
                "tool_ids": ["web_search_tool"]
            },
            {
                "id": "agent_summarizer",
                "name": "Summarizer Agent",
                "color": "#e53e3e",
                "status": "idle",
                "speech": "Xin chào! Tôi giúp cô đọng ngữ cảnh và lịch sử chat.",
                "pos_x": 0.0,
                "pos_y": 1.0,
                "pos_z": -2.0,
                "prompt_id": "chuyen_gia_tom_tat",
                "tool_ids": ["summarizer_tool"]
            }
        ]

        for agent_data in default_agents:
            existing = db.query(AgentModel).filter(AgentModel.id == agent_data["id"]).first()
            if not existing:
                tool_ids = agent_data.pop("tool_ids", [])
                
                # Tạo đối tượng Agent mới
                new_agent = AgentModel(**agent_data)
                
                # Gán danh sách Tools tương ứng
                if tool_ids:
                    tools = db.query(ToolModel).filter(ToolModel.id.in_(tool_ids)).all()
                    new_agent.tools = tools

                db.add(new_agent)
                print(f"[AgentSeeder] Added default agent: {agent_data['name']}")

        db.commit()
        print("[AgentSeeder] Default agents seeded successfully.")
    except Exception as e:
        db.rollback()
        print(f"[AgentSeeder] Error seeding agents: {str(e)}")