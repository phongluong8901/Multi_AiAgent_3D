from sqlalchemy.orm import Session
from app.models.agent import AgentModel
from app.models.tool import ToolModel

DEFAULT_AGENTS = [
    {
        "id": "agent_search",
        "name": "Search Agent",
        "description": "Chuyên viên tìm kiếm thông tin trên mạng và tra cứu bách khoa toàn thư Wikipedia.",
        "model": "gemini-2.5-flash",
        "prompt_id": "prompt_search",
        "tools": ["web_search_tool", "wikipedia_tool"],
    },
    {
        "id": "agent_calculate",
        "name": "Calculate & Finance Agent",
        "description": "Chuyên viên tính toán toán học, thống kê và phân tích tài chính đầu tư (ROI, NPV, CAGR, Lãi kép, Tỷ giá).",
        "model": "gemini-2.5-flash",
        "prompt_id": "prompt_calculate",
        "tools": ["calculator_tool", "financial_market_tool"],
    },
    {
        "id": "agent_analysis",
        "name": "Analysis & Sentiment Agent",
        "description": "Chuyên viên phân tích dữ liệu thống kê, xử lý tệp CSV, chuyển đổi JSON/Regex và phân tích cảm xúc.",
        "model": "gemini-2.5-flash",
        "prompt_id": "prompt_analysis",
        "tools": [
            "data_analysis_tool",
            "csv_analyzer_tool",
            "json_data_transformer_tool",
            "sentiment_analysis_tool",
        ],
    },
    {
        "id": "agent_summarizer",
        "name": "Summarizer Agent",
        "description": "Chuyên viên tóm tắt văn bản, chắt lọc ý chính và đánh giá sắc thái cảm xúc tài liệu.",
        "model": "gemini-2.5-flash",
        "prompt_id": "prompt_summarizer",
        "tools": ["summarizer_tool", "sentiment_analysis_tool"],
    },
    {
        "id": "agent_manager",
        "name": "Manager Agent",
        "description": "Trưởng nhóm điều phối công việc, lập kế hoạch đa tác tử và giám sát sức khỏe hệ thống Microservices.",
        "model": "gemini-2.5-flash",
        "prompt_id": "prompt_manager",
        "tools": ["workflow_planner_tool", "system_health_tool"],
    },
    {
        "id": "agent_coder",
        "name": "Coder, SQL & Security Agent",
        "description": "Kỹ sư lập trình Python, thực thi Sandbox, thiết kế truy vấn SQL tối ưu và kiểm toán bảo mật mã nguồn (SAST).",
        "model": "gemini-2.5-flash",
        "prompt_id": "prompt_coder",
        "tools": [
            "python_code_generator_tool",
            "python_sandbox_tool",
            "sql_query_generator_tool",
            "security_code_auditor_tool",
        ],
    },
    {
        "id": "agent_ml",
        "name": "Machine Learning Agent",
        "description": "Chuyên gia đánh giá mô hình Học máy (Accuracy, F1, RMSE), RL và tư vấn kiến trúc AI.",
        "model": "gemini-2.5-flash",
        "prompt_id": "prompt_ml",
        "tools": ["ml_evaluator_tool", "data_analysis_tool"],
    },
    {
        "id": "agent_vision",
        "name": "Vision & OCR Agent",
        "description": "Chuyên gia thị giác máy tính: phân tích hình ảnh, nhận diện vật thể và trích xuất chữ viết OCR.",
        "model": "gemini-2.5-flash",
        "prompt_id": "prompt_vision",
        "tools": ["image_analyzer_tool"],
    },
]


def seed_agents(db: Session):
    for item in DEFAULT_AGENTS:
        tool_ids = item.get("tools", [])
        tool_objs = (
            db.query(ToolModel).filter(ToolModel.id.in_(tool_ids)).all()
            if tool_ids
            else []
        )
        existing = db.query(AgentModel).filter(AgentModel.id == item["id"]).first()
        if not existing:
            new_agent = AgentModel(
                id=item["id"],
                name=item["name"],
                model=item.get("model", "gemini-2.5-flash-lite"),
                prompt_id=item.get("prompt_id"),
                speech=item.get("description", ""),
            )
            new_agent.tools = tool_objs
            db.add(new_agent)
        else:
            existing.name = item["name"]
            existing.prompt_id = item.get("prompt_id")
            if item.get("model"):
                existing.model = item["model"]
            existing.tools = tool_objs
    db.commit()
