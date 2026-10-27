from sqlalchemy.orm import Session
from app.models.tool import ToolModel

def seed_tools(db: Session):
    try:
        default_tools = [
            # 1. Manager Tools
            {
                "id": "workflow_planner_tool",
                "name": "Workflow Planner",
                "description": "Công cụ lập kế hoạch và phân rã bài toán: chia nhỏ mục tiêu thành các bước tuần tự và chỉ định agent phụ trách."
            },
            {
                "id": "system_control_tool",
                "name": "Microservices Controller",
                "description": "Công cụ quản lý, kiểm tra trạng thái sức khỏe (health-check) và điều phối các service qua API Gateway."
            },

            # 2. Search Tools
            {
                "id": "web_search_tool",
                "name": "Web Search (Tavily)",
                "description": "Công cụ tra cứu thông tin, tin tức thời sự và tri thức mới nhất trên Internet qua Tavily Search."
            },
            {
                "id": "google_search_tool",
                "name": "Google Custom Search",
                "description": "Công cụ tìm kiếm thông tin trực tiếp từ Google Search API."
            },
            {
                "id": "web_crawler_tool",
                "name": "Web Crawler & Parser",
                "description": "Công cụ cào và trích xuất nội dung toàn văn từ đường dẫn URL trang web."
            },

            # 3. Summary Tools
            {
                "id": "summarizer_tool",
                "name": "Text Summarizer",
                "description": "Công cụ cô đọng văn bản dài thành báo cáo 3 phần súc tích (150-250 từ)."
            },
            {
                "id": "text_summarizer",
                "name": "Smart Text Summarizer",
                "description": "Bộ tóm tắt thông minh trích xuất các ý chính và câu quan trọng nhất."
            },

            # 4. Calculate Tools
            {
                "id": "calculator_tool",
                "name": "Calculator",
                "description": "Công cụ tính toán số học, đại số, phần trăm, tài chính với độ chính xác tuyệt đối."
            },

            # 5. Analysis Tools
            {
                "id": "data_analysis_tool",
                "name": "Data Analyst & Statistics",
                "description": "Công cụ phân tích dữ liệu thống kê: mean, median, min, max, độ lệch chuẩn (std) và phát hiện xu hướng (trend)."
            },
            {
                "id": "db_query_tool",
                "name": "Database Analyzer",
                "description": "Công cụ phân tích và kiểm tra cấu trúc dữ liệu hệ thống."
            },

            # 6. Machine Learning Tools
            {
                "id": "ml_evaluator_tool",
                "name": "ML Evaluator & Metrics",
                "description": "Công cụ tính toán chỉ số học máy (Accuracy, Precision, Recall, F1, MSE, RMSE) và gợi ý thuật toán ML tối ưu."
            },

            # 7. Data Visualization Tools
            {
                "id": "data_visualization_tool",
                "name": "Data Visualizer & Chart Generator",
                "description": "Công cụ tạo biểu đồ đường (Line), cột (Bar), tròn (Pie), diện tích (Area), tự động vẽ biểu đồ trực quan kèm bảng số liệu chi tiết."
            },
            {
                "id": "visualization_tool",
                "name": "Visualization Tool",
                "description": "Bí danh công cụ trực quan hóa số liệu và biến động thị trường."
            },

            # 8. Computer Vision & OCR Tools
            {
                "id": "image_analyzer_tool",
                "name": "Image OCR & Vision Classifier",
                "description": "Công cụ thị giác máy tính: Trích xuất toàn văn chữ/hóa đơn (OCR) và phân loại, nhận diện đối tượng trong ảnh."
            },

            # 9. CSV Profiling & Analysis Tools
            {
                "id": "csv_analyzer_tool",
                "name": "CSV Data Profiler & Analyzer",
                "description": "Công cụ phân tích chuyên sâu file CSV: cấu trúc số dòng/cột, tỷ lệ thiếu dữ liệu, thống kê mô tả và insights."
            },

            # 10. Python Code Generation Tools
            {
                "id": "python_code_generator_tool",
                "name": "Python Code Generator",
                "description": "Công cụ sinh mã nguồn Python chuyên nghiệp, chuẩn PEP8, có type hints, docstring và ví dụ test chạy thử."
            },

            # 11. Isolated Sandbox Execution Tools
            {
                "id": "python_sandbox_tool",
                "name": "Isolated Python Sandbox Runner",
                "description": "Công cụ thực thi mã Python an toàn trong Container Sandbox cô lập, bảo mật dữ liệu tuyệt đối và chặn lệnh nguy hiểm."
            },

            # 12. PDF & Document Intelligence Tools
            {
                "id": "pdf_analyzer_tool",
                "name": "PDF Document Analyzer & OCR",
                "description": "Công cụ đọc và phân tích file PDF: bóc tách bảng số liệu, trích xuất hóa đơn, báo cáo tài chính và tóm tắt văn bản."
            },
        ]

        for tool_data in default_tools:
            existing = db.query(ToolModel).filter(ToolModel.id == tool_data["id"]).first()
            if not existing:
                db.add(ToolModel(**tool_data))
                print(f"[ToolSeeder] Added default tool: {tool_data['name']}")
            else:
                existing.name = tool_data["name"]
                existing.description = tool_data["description"]

        db.commit()
        print("[ToolSeeder] Default tools seeded successfully.")
    except Exception as e:
        db.rollback()
        print(f"[ToolSeeder] Error seeding tools: {str(e)}")