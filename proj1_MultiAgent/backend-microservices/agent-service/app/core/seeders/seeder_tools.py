from sqlalchemy.orm import Session
from app.models.tool import ToolModel

def seed_tools(db: Session):
    try:
        default_tools = [
            {
                "id": "calculator_tool",
                "name": "Calculator",
                "description": "Công cụ tính toán số học và xử lý biểu thức toán học cơ bản."
            },
            {
                "id": "web_search_tool",
                "name": "Web Search Engine",
                "description": "Công cụ tra cứu thông tin, tài liệu kỹ thuật mới nhất trên internet (dành cho Chuyên gia tìm kiếm)."
            },
            {
                "id": "db_query_tool",
                "name": "Database Analyzer",
                "description": "Công cụ phân tích, kiểm tra và truy vấn cấu trúc dữ liệu (PostgreSQL/MongoDB)."
            },
            {
                "id": "summarizer_tool",
                "name": "Text Summarizer",
                "description": "Công cụ cô đọng văn bản, rút gọn lịch sử hội thoại dài thành các ý chính."
            },
            {
                "id": "system_control_tool",
                "name": "Microservices Controller",
                "description": "Công cụ quản lý, kiểm tra trạng thái sức khỏe (health-check) và điều phối các service qua API Gateway."
            },
            {
                "id": "web_crawler_tool",
                "name": "Web Crawler & Parser",
                "description": "Công cụ cào và phân tích cấu trúc bài viết báo chí hoặc trang danh mục thông minh."
            }
        ]

        for tool_data in default_tools:
            existing = db.query(ToolModel).filter(ToolModel.id == tool_data["id"]).first()
            if not existing:
                db.add(ToolModel(**tool_data))
                print(f"[ToolSeeder] Added default tool: {tool_data['name']}")

        db.commit()
        print("[ToolSeeder] Default tools seeded successfully.")
    except Exception as e:
        db.rollback()
        print(f"[ToolSeeder] Error seeding tools: {str(e)}")