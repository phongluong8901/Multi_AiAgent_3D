from sqlalchemy.orm import Session
from app.models.sql_models import Tool

DEFAULT_TOOLS = [
    {
        "id": "web_search_tool",
        "name": "Web Search",
        "description": "Công cụ tìm kiếm thông tin trên mạng internet (DuckDuckGo & Google).",
    },
    {
        "id": "wikipedia_tool",
        "name": "Wikipedia Encyclopedia",
        "description": "Tra cứu bách khoa toàn thư Wikipedia đa ngôn ngữ (Việt/Anh) về lịch sử, khoa học, khái niệm.",
    },
    {
        "id": "web_crawler_tool",
        "name": "Web Content Crawler",
        "description": "Thu thập và trích xuất nội dung bài viết chi tiết từ đường dẫn URL trang web.",
    },
    {
        "id": "data_visualization_tool",
        "name": "Interactive Chart & Visualization",
        "description": "Tạo biểu đồ trực quan (Line, Bar, Pie, Area) từ dữ liệu chuỗi thời gian hoặc phân phối.",
    },
    {
        "id": "pdf_analyzer_tool",
        "name": "PDF Document Analyzer",
        "description": "Đọc, trích xuất văn bản, bảng biểu và phân tích nội dung tài liệu PDF.",
    },
    {
        "id": "calculator_tool",
        "name": "Scientific Calculator",
        "description": "Công cụ tính toán toán học, đại số, lượng giác, logarit và thống kê nâng cao.",
    },
    {
        "id": "financial_market_tool",
        "name": "Financial & Investment Analyzer",
        "description": "Tính lãi kép, ROI, CAGR, định giá dòng tiền NPV, lịch trả góp khoản vay và quy đổi tỷ giá ngoại tệ/Crypto/Vàng.",
    },
    {
        "id": "data_analysis_tool",
        "name": "Data Analysis",
        "description": "Phân tích thống kê dữ liệu mảng số: tính trung bình, trung vị, phương sai, độ lệch chuẩn và xu hướng.",
    },
    {
        "id": "csv_analyzer_tool",
        "name": "CSV Data Analyzer",
        "description": "Phân tích tập dữ liệu CSV thực tế: đọc các cột, kiểm tra giá trị khuyết thiếu (missing values) và thống kê mô tả.",
    },
    {
        "id": "json_data_transformer_tool",
        "name": "JSON & Regex Data Transformer",
        "description": "Chuẩn hóa dữ liệu JSON, chuyển đổi JSON sang bảng Markdown/CSV và trích xuất Email, SĐT, URL bằng Regex.",
    },
    {
        "id": "sentiment_analysis_tool",
        "name": "Sentiment & Emotion Analyzer",
        "description": "Phân tích sắc thái cảm xúc văn bản Việt - Anh (Tích cực/Tiêu cực/Trung lập), điểm số cảm xúc và tín hiệu rủi ro.",
    },
    {
        "id": "summarizer_tool",
        "name": "Text Summarizer",
        "description": "Trích xuất ý chính, đếm từ khóa và cô đọng văn bản dài thành bản tóm tắt súc tích.",
    },
    {
        "id": "workflow_planner_tool",
        "name": "Workflow Planner",
        "description": "Phân rã bài toán phức tạp thành các bước tuần tự và chỉ định agent chuyên trách phù hợp.",
    },
    {
        "id": "system_health_tool",
        "name": "Cluster & System Health Monitor",
        "description": "Giám sát trạng thái hoạt động của hệ thống Microservices, cụm Distributed Worker, Owner Rental và Local Ollama.",
    },
    {
        "id": "python_code_generator_tool",
        "name": "Python Code Generator",
        "description": "Tạo cấu trúc mã nguồn Python chuẩn mực, kèm kiểm tra cú pháp AST tự động.",
    },
    {
        "id": "python_sandbox_tool",
        "name": "Python Sandbox Executor",
        "description": "Thực thi mã nguồn Python an toàn trong môi trường cô lập (Sandbox) và trả về kết quả chạy code thực tế (stdout/stderr).",
    },
    {
        "id": "sql_query_generator_tool",
        "name": "SQL Schema & Query Generator",
        "description": "Thiết kế bảng cơ sở dữ liệu (DDL), sinh câu truy vấn SQL tối ưu (JOIN, CTE, Window Function) và gợi ý đánh Index.",
    },
    {
        "id": "security_code_auditor_tool",
        "name": "Security & SAST Code Auditor",
        "description": "Kiểm toán bảo mật mã nguồn theo chuẩn OWASP (phát hiện SQLi, XSS, Command Injection, lộ API Key) và đánh giá độ phức tạp Big-O.",
    },
    {
        "id": "ml_evaluator_tool",
        "name": "Machine Learning Evaluator",
        "description": "Tính toán các chỉ số đánh giá mô hình học máy (Accuracy, Precision, Recall, F1, MSE, RMSE) và gợi ý thuật toán ML.",
    },
    {
        "id": "image_analyzer_tool",
        "name": "Image & Vision Analyzer",
        "description": "Phân tích hình ảnh, nhận diện vật thể, kiểm tra thông số ảnh và trích xuất văn bản OCR.",
    },
]


def seed_tools(db: Session):
    for item in DEFAULT_TOOLS:
        existing = db.query(Tool).filter(Tool.id == item["id"]).first()
        if not existing:
            db.add(Tool(**item))
        else:
            existing.name = item["name"]
            existing.description = item["description"]
    db.commit()
