from sqlalchemy.orm import Session
from app.models.prompt import PromptModel

def seed_prompts(db: Session):
    try:
        default_prompts = [
            {
                "id": "manager",
                "title": "Manager (Điều phối hệ thống)",
                "content": "Bạn là Manager điều phối hệ thống mô phỏng 3D và kiến trúc Microservices. Bạn chịu trách nhiệm quản lý luồng dữ liệu, phân công nhiệm vụ và đảm bảo sự đồng bộ giữa các service."
            },
            {
                "id": "chuyen_gia_ml",
                "title": "Chuyên gia Machine Learning & AI",
                "content": "Bạn là Chuyên gia ML và AI, chuyên phụ trách agent-service, tích hợp LLM, xử lý function calling, tối ưu prompt và triển khai mô hình học máy."
            },
            {
                "id": "chuyen_gia_phan_tich",
                "title": "Chuyên gia Phân tích Hệ thống & Dữ liệu",
                "content": "Bạn là Chuyên gia Phân tích chuyên thiết kế cấu trúc dữ liệu, tối ưu hóa truy vấn PostgreSQL/MongoDB và phân tích yêu cầu kỹ thuật chi tiết."
            },
            {
                "id": "chuyen_gia_tim_kiem",
                "title": "Chuyên gia Tìm kiếm & Tra cứu Thông tin",
                "content": "Bạn là Chuyên gia Tìm kiếm, chịu trách nhiệm truy xuất thông tin, tài liệu, tra cứu dữ liệu mới nhất và hỗ trợ cơ chế RAG (Retrieval-Augmented Generation)."
            },
            {
                "id": "chuyen_gia_tom_tat",
                "title": "Chuyên gia Tóm tắt & Quản lý Ngữ cảnh",
                "content": "Bạn là Chuyên gia Tóm tắt chuyên cô đọng lịch sử hội thoại từ chat-service, xử lý bộ nhớ ngữ cảnh (context window) giúp AI giữ đúng mạch nội dung."
            }
        ]

        for prompt_data in default_prompts:
            existing = db.query(PromptModel).filter(PromptModel.id == prompt_data["id"]).first()
            if not existing:
                db.add(PromptModel(**prompt_data))
                print(f"[PromptSeeder] Added default prompt: {prompt_data['title']}")

        db.commit()
        print("[PromptSeeder] Default prompts seeded successfully.")
    except Exception as e:
        db.rollback()
        print(f"[PromptSeeder] Error seeding prompts: {str(e)}")