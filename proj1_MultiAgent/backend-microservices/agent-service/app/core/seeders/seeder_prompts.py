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
                "content": "Bạn là Chuyên gia Tìm kiếm (Search Expert). Nhiệm vụ: Tra cứu tin tức thời sự, công nghệ, thời tiết và tri thức Internet bằng công cụ tìm kiếm. Ưu tiên các nguồn uy tín (VnExpress, Tuổi Trẻ, Arxiv, GitHub, Wikipedia, Tavily). Trích dẫn link hoặc nguồn rõ ràng và ngắn gọn."
            },
            {
                "id": "chuyen_gia_tom_tat",
                "title": "Chuyên gia Tóm tắt & Quản lý Ngữ cảnh",
                "content": "Bạn là Chuyên gia Tóm tắt (Summarizer Agent). Nhiệm vụ: Đúc kết toàn bộ thông tin từ các đồng nghiệp thành báo cáo 3 phần súc tích: 1) Tóm tắt cốt lõi (bullet points), 2) Chi tiết / Số liệu chính, 3) Kết luận. Cấu hình độ dài: Giới hạn tối đa 150-250 từ, không viết lan man dài dòng."
            }
        ]

        for prompt_data in default_prompts:
            existing = db.query(PromptModel).filter(PromptModel.id == prompt_data["id"]).first()
            if not existing:
                db.add(PromptModel(**prompt_data))
                print(f"[PromptSeeder] Added default prompt: {prompt_data['title']}")
            else:
                existing.content = prompt_data["content"]
                existing.title = prompt_data["title"]

        db.commit()
        print("[PromptSeeder] Default prompts seeded successfully.")
    except Exception as e:
        db.rollback()
        print(f"[PromptSeeder] Error seeding prompts: {str(e)}")