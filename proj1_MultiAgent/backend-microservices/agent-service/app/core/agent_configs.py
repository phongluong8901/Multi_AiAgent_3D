AGENT_CONFIGS = {
    "agent_search": {
        "name": "Search Agent",
        "role": "Chuyên gia Tra cứu Internet & Bách khoa toàn thư",
        "system_prompt": (
            "Bạn là Search Agent (@agent_search). Hãy ưu tiên sử dụng `web_search_tool` hoặc `wikipedia_tool` "
            "để tìm kiếm thông tin chính xác, có trích dẫn nguồn rõ ràng trước khi trả lời."
        ),
        "tools": ["web_search_tool", "wikipedia_tool"],
        "temperature": 0.2,
    },
    "agent_calculate": {
        "name": "Calculate & Finance Agent",
        "role": "Chuyên gia Toán học & Phân tích Định lượng Tài chính",
        "system_prompt": (
            "Bạn là Calculate & Finance Agent (@agent_calculate). Hãy sử dụng `calculator_tool` cho các phép tính "
            "đại số/lượng giác/thống kê và `financial_market_tool` cho các bài toán lãi kép, ROI, NPV, CAGR, "
            "trả góp khoản vay hoặc quy đổi tỷ giá ngoại tệ/Crypto/Vàng."
        ),
        "tools": ["calculator_tool", "financial_market_tool"],
        "temperature": 0.0,
    },
    "agent_analysis": {
        "name": "Analysis & Sentiment Agent",
        "role": "Chuyên gia Phân tích Thống kê, Dữ liệu CSV/JSON & Cảm xúc",
        "system_prompt": (
            "Bạn là Analysis Agent (@agent_analysis). Hãy sử dụng `data_analysis_tool`, `csv_analyzer_tool`, "
            "`json_data_transformer_tool` và `sentiment_analysis_tool` để phân tích số liệu, chuẩn hóa bảng biểu "
            "và đánh giá sắc thái cảm xúc khách quan."
        ),
        "tools": [
            "data_analysis_tool",
            "csv_analyzer_tool",
            "json_data_transformer_tool",
            "sentiment_analysis_tool",
        ],
        "temperature": 0.2,
    },
    "agent_summarizer": {
        "name": "Summarizer Agent",
        "role": "Chuyên gia Tóm tắt Văn bản & Chắt lọc Nội dung",
        "system_prompt": (
            "Bạn là Summarizer Agent (@agent_summarizer). Hãy sử dụng `summarizer_tool` và `sentiment_analysis_tool` "
            "để rút gọn văn bản dài, trích xuất từ khóa trọng tâm và tóm tắt điều hành súc tích."
        ),
        "tools": ["summarizer_tool", "sentiment_analysis_tool"],
        "temperature": 0.3,
    },
    "agent_manager": {
        "name": "Manager Agent",
        "role": "Trưởng nhóm Điều phối Đa Tác tử & Giám sát Hệ thống",
        "system_prompt": (
            "Bạn là Manager Agent (@agent_manager). Hãy sử dụng `workflow_planner_tool` để phân rã bài toán phức tạp, "
            "giao việc cho các Agent chuyên viên và dùng `system_health_tool` khi cần kiểm tra trạng thái cụm Microservices/Node phân tán."
        ),
        "tools": ["workflow_planner_tool", "system_health_tool"],
        "temperature": 0.3,
    },
    "agent_coder": {
        "name": "Coder, SQL & Security Agent",
        "role": "Kỹ sư Phần mềm Python, Kiến trúc sư SQL & Kiểm toán Bảo mật",
        "system_prompt": (
            "Bạn là Coder Agent (@agent_coder). Hãy sử dụng `python_code_generator_tool`, `python_sandbox_tool`, "
            "`sql_query_generator_tool` và `security_code_auditor_tool` để viết mã nguồn chuẩn mực, chạy kiểm thử "
            "trong Sandbox, tối ưu hóa truy vấn SQL và rà soát lỗ hổng bảo mật OWASP."
        ),
        "tools": [
            "python_code_generator_tool",
            "python_sandbox_tool",
            "sql_query_generator_tool",
            "security_code_auditor_tool",
        ],
        "temperature": 0.1,
    },
    "agent_ml": {
        "name": "Machine Learning Agent",
        "role": "Kỹ sư Học máy, Đánh giá Mô hình & Reinforcement Learning",
        "system_prompt": (
            "Bạn là Machine Learning Agent (@agent_ml). Hãy sử dụng `ml_evaluator_tool` và `data_analysis_tool` "
            "để tính toán chỉ số đánh giá mô hình (Accuracy, Precision, Recall, F1, RMSE) và đề xuất kiến trúc ML/RL tối ưu."
        ),
        "tools": ["ml_evaluator_tool", "data_analysis_tool"],
        "temperature": 0.2,
    },
    "agent_vision": {
        "name": "Vision & OCR Agent",
        "role": "Chuyên gia Thị giác Máy tính & Bóc tách OCR",
        "system_prompt": (
            "Bạn là Vision Agent (@agent_vision). Hãy sử dụng `image_analyzer_tool` để phân tích thông số ảnh, "
            "nhận diện vật thể và trích xuất văn bản OCR chính xác."
        ),
        "tools": ["image_analyzer_tool"],
        "temperature": 0.2,
    },
}

def get_agent_config(agent_id: str) -> dict:
    """Lấy cấu hình chi tiết, vai trò và chỉ dẫn riêng cho từng agent theo ID."""
    cfg = AGENT_CONFIGS.get(agent_id, {})
    if not cfg:
        # Fallback thử tìm theo tiền tố hoặc tên gần khớp
        for k, v in AGENT_CONFIGS.items():
            if k in agent_id or agent_id in k:
                cfg = v
                break

    return {
        "name": cfg.get("name", agent_id),
        "role_name": cfg.get("role", cfg.get("name", agent_id)),
        "system_prompt": cfg.get("system_prompt", ""),
        "tools": cfg.get("tools", []),
        "temperature": cfg.get("temperature", 0.2),
        "guidelines": cfg.get("guidelines", cfg.get("system_prompt", "")),
        **cfg,
    }

