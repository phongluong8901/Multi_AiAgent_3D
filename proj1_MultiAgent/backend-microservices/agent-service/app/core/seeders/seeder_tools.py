from sqlalchemy.orm import Session
from app.models.tool import ToolModel

DEFAULT_TOOLS = [
    # --- NHÓM TÌM KIẾM WEB (TÁCH RÕ: 1 CUSTOM FREE & 2 API SEARCH) ---
    {
        "id": "duckduckgo_search",
        "name": "[Free] DuckDuckGo & Weather Search",
        "description": "[Không cần API Key] Tìm kiếm Internet miễn phí qua DuckDuckGo, tra cứu thời tiết trực tiếp (Open-Meteo) và Wikipedia.",
        "category": "web",
    },
    {
        "id": "web_search_tool",
        "name": "[API] Tavily Web Search",
        "description": "[Dùng API: TAVILY_API_KEY] Công cụ tìm kiếm thông tin và tổng hợp câu trả lời AI từ Tavily Search API.",
        "category": "api",
    },
    {
        "id": "google_search_tool",
        "name": "[API] Google Custom Search",
        "description": "[Dùng API: GOOGLE_API_KEY, GOOGLE_CSE_ID] Tìm kiếm thông tin trực tiếp từ Google Custom Search JSON API.",
        "category": "api",
    },
    {
        "id": "wikipedia_tool",
        "name": "[Free] Wikipedia Encyclopedia",
        "description": "[Không cần API Key] Tra cứu bách khoa toàn thư Wikipedia đa ngôn ngữ (Việt/Anh) về lịch sử, khoa học, khái niệm.",
        "category": "web",
    },
    {
        "id": "web_crawler_tool",
        "name": "[Free] Web Content Crawler",
        "description": "[Không cần API Key] Thu thập và trích xuất nội dung bài viết chi tiết từ đường dẫn URL trang web.",
        "category": "web",
    },
    # --- NHÓM CÔNG CỤ TÍCH HỢP NỘI BỘ (KHÔNG CẦN API KEY) ---
    {
        "id": "data_visualization_tool",
        "name": "Interactive Chart & Visualization",
        "description": "[Local Built-in] Tạo biểu đồ trực quan (Line, Bar, Pie, Area) từ dữ liệu chuỗi thời gian hoặc phân phối.",
        "category": "data",
    },
    {
        "id": "pdf_analyzer_tool",
        "name": "PDF Document Analyzer",
        "description": "[Local Built-in] Đọc, trích xuất văn bản, bảng biểu và phân tích nội dung tài liệu PDF.",
        "category": "data",
    },
    {
        "id": "calculator_tool",
        "name": "Scientific Calculator",
        "description": "[Local Built-in] Công cụ tính toán toán học, đại số, lượng giác, logarit và thống kê nâng cao.",
        "category": "utility",
    },
    {
        "id": "financial_market_tool",
        "name": "Financial & Investment Analyzer",
        "description": "[Local Built-in] Tính lãi kép, ROI, CAGR, định giá dòng tiền NPV, lịch trả góp khoản vay và quy đổi tỷ giá ngoại tệ/Crypto/Vàng.",
        "category": "utility",
    },
    {
        "id": "data_analysis_tool",
        "name": "Data Analysis",
        "description": "[Local Built-in] Phân tích thống kê dữ liệu mảng số: tính trung bình, trung vị, phương sai, độ lệch chuẩn và xu hướng.",
        "category": "data",
    },
    {
        "id": "csv_analyzer_tool",
        "name": "CSV Data Analyzer",
        "description": "[Local Built-in] Phân tích tập dữ liệu CSV thực tế: đọc các cột, kiểm tra giá trị khuyết thiếu (missing values) và thống kê mô tả.",
        "category": "data",
    },
    {
        "id": "json_data_transformer_tool",
        "name": "JSON & Regex Data Transformer",
        "description": "[Local Built-in] Chuẩn hóa dữ liệu JSON, chuyển đổi JSON sang bảng Markdown/CSV và trích xuất Email, SĐT, URL bằng Regex.",
        "category": "data",
    },
    {
        "id": "sentiment_analysis_tool",
        "name": "Sentiment & Emotion Analyzer",
        "description": "[Local Built-in] Phân tích sắc thái cảm xúc văn bản Việt - Anh (Tích cực/Tiêu cực/Trung lập), điểm số cảm xúc và tín hiệu rủi ro.",
        "category": "nlp",
    },
    {
        "id": "summarizer_tool",
        "name": "Text Summarizer",
        "description": "[Local Built-in] Trích xuất ý chính, đếm từ khóa và cô đọng văn bản dài thành bản tóm tắt súc tích.",
        "category": "nlp",
    },
    {
        "id": "workflow_planner_tool",
        "name": "Workflow Planner",
        "description": "[Local Built-in] Phân rã bài toán phức tạp thành các bước tuần tự và chỉ định agent chuyên trách phù hợp.",
        "category": "utility",
    },
    {
        "id": "system_health_tool",
        "name": "Cluster & System Health Monitor",
        "description": "[Local Built-in] Giám sát trạng thái hoạt động của hệ thống Microservices, cụm Distributed Worker, Owner Rental và Local Ollama.",
        "category": "utility",
    },
    {
        "id": "python_code_generator_tool",
        "name": "Python Code Generator",
        "description": "[Local Built-in] Tạo cấu trúc mã nguồn Python chuẩn mực, kèm kiểm tra cú pháp AST tự động.",
        "category": "utility",
    },
    {
        "id": "python_sandbox_tool",
        "name": "Python Sandbox Executor",
        "description": "[Local Built-in] Thực thi mã nguồn Python an toàn trong môi trường cô lập (Sandbox) và trả về kết quả chạy code thực tế (stdout/stderr).",
        "category": "utility",
    },
    {
        "id": "sql_query_generator_tool",
        "name": "SQL Schema & Query Generator",
        "description": "[Local Built-in] Thiết kế bảng cơ sở dữ liệu (DDL), sinh câu truy vấn SQL tối ưu (JOIN, CTE, Window Function) và gợi ý đánh Index.",
        "category": "utility",
    },
    {
        "id": "security_code_auditor_tool",
        "name": "Security & SAST Code Auditor",
        "description": "[Local Built-in] Kiểm toán bảo mật mã nguồn theo chuẩn OWASP (phát hiện SQLi, XSS, Command Injection, lộ API Key) và đánh giá độ phức tạp Big-O.",
        "category": "utility",
    },
    {
        "id": "ml_evaluator_tool",
        "name": "Machine Learning Evaluator",
        "description": "[Local Built-in] Tính toán các chỉ số đánh giá mô hình học máy (Accuracy, Precision, Recall, F1, MSE, RMSE) và gợi ý thuật toán ML.",
        "category": "data",
    },
    # --- NHÓM CÔNG CỤ THỊ GIÁC DÙNG API ---
    {
        "id": "image_analyzer_tool",
        "name": "[API] Image & Vision Analyzer",
        "description": "[Dùng API: GOOGLE_API_KEY_MODEL] Phân tích hình ảnh, nhận diện vật thể, kiểm tra thông số ảnh và trích xuất văn bản OCR qua Gemini Vision API.",
        "category": "api",
    },
]


def seed_tools(db: Session):
    for item in DEFAULT_TOOLS:
        existing = db.query(ToolModel).filter(ToolModel.id == item["id"]).first()
        if not existing:
            db.add(
                ToolModel(
                    id=item["id"],
                    name=item["name"],
                    description=item.get("description", ""),
                    category=item.get("category", "builtin"),
                )
            )
        else:
            setattr(existing, "name", str(item["name"]))
            setattr(existing, "description", str(item.get("description", "")))
            setattr(existing, "category", str(item.get("category") or getattr(existing, "category", None) or "builtin"))
    db.commit()
