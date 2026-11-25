from sqlalchemy.orm import Session
from app.models.agent import AgentModel
from app.models.tool import ToolModel

DEFAULT_AGENTS = [
    {
        "id": "agent_search",
        "name": "Search Agent",
        "description": "Chuyên viên tìm kiếm thông tin trên mạng (DuckDuckGo Free, Tavily API, Google Search API) và tra cứu Wikipedia.",
        "model": "gemini-3.5-flash-lite",
        "prompt_id": "prompt_search",
        "tools": ["duckduckgo_search", "web_search_tool", "google_search_tool", "wikipedia_tool"],
    },
    {
        "id": "agent_calculate",
        "name": "Calculate & Finance Agent",
        "description": "Chuyên viên tính toán toán học, thống kê và phân tích tài chính đầu tư (ROI, NPV, CAGR, Lãi kép, Tỷ giá).",
        "model": "gemini-3.5-flash-lite",
        "prompt_id": "prompt_calculate",
        "tools": ["calculator_tool", "financial_market_tool"],
    },
    {
        "id": "agent_analysis",
        "name": "Analysis & Sentiment Agent",
        "description": "Chuyên viên phân tích dữ liệu thống kê, xử lý tệp CSV, chuyển đổi JSON/Regex và phân tích cảm xúc.",
        "model": "gemini-3.5-flash-lite",
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
        "model": "gemini-3.5-flash-lite",
        "prompt_id": "prompt_summarizer",
        "tools": ["summarizer_tool", "sentiment_analysis_tool"],
    },
    {
        "id": "agent_manager",
        "name": "Manager Agent",
        "description": "Trưởng nhóm điều phối công việc, lập kế hoạch đa tác tử và giám sát sức khỏe hệ thống Microservices.",
        "model": "gemini-3.5-flash-lite",
        "prompt_id": "prompt_manager",
        "tools": ["workflow_planner_tool", "system_health_tool"],
    },
    {
        "id": "agent_coder",
        "name": "Coder, SQL & Security Agent",
        "description": "Kỹ sư lập trình Python, thực thi Sandbox, thiết kế truy vấn SQL tối ưu và kiểm toán bảo mật mã nguồn (SAST).",
        "model": "gemini-3.5-flash-lite",
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
        "model": "gemini-3.5-flash-lite",
        "prompt_id": "prompt_ml",
        "tools": ["ml_evaluator_tool", "data_analysis_tool"],
    },
    {
        "id": "agent_vision",
        "name": "Vision & OCR Agent",
        "description": "Chuyên gia thị giác máy tính: phân tích hình ảnh, nhận diện vật thể và trích xuất chữ viết OCR.",
        "model": "gemini-3.5-flash-lite",
        "prompt_id": "prompt_vision",
        "tools": ["image_analyzer_tool"],
    },
]


def seed_agents(db: Session):
    for item in DEFAULT_AGENTS:
        raw_tools = item.get("tools")
        tool_ids: list[str] = [str(t) for t in raw_tools] if isinstance(raw_tools, list) else []
        tool_objs = (
            db.query(ToolModel).filter(ToolModel.id.in_(tool_ids)).all()
            if tool_ids
            else []
        )
        existing = db.query(AgentModel).filter(AgentModel.id == str(item["id"])).first()
        if not existing:
            new_agent = AgentModel(
                id=str(item["id"]),
                name=str(item["name"]),
                model=str(item.get("model") or "gemini-3.5-flash-lite"),
                prompt_id=str(item["prompt_id"]) if item.get("prompt_id") else None,
                speech=str(item.get("description") or ""),
            )
            new_agent.tools = tool_objs
            db.add(new_agent)
        else:
            setattr(existing, "name", str(item["name"]))
            setattr(existing, "prompt_id", str(item["prompt_id"]) if item.get("prompt_id") else None)
            current_model = str(getattr(existing, "model", "") or "")
            if not current_model or current_model == "gemini-2.5-flash":
                setattr(existing, "model", str(item.get("model") or "gemini-3.5-flash-lite"))
            existing.tools = tool_objs
    db.commit()
