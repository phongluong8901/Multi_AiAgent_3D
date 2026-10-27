from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.api.deps import get_db
from app.services.agent_lab_service import agent_lab_service

router = APIRouter(prefix="/lab", tags=["Agent Lab Generator 3D"])


class GenerateAgentRequest(BaseModel):
    goal: str
    target_model: Optional[str] = "gemini-2.5-flash-lite"
    save_to_db: Optional[bool] = True


@router.get("/templates")
def get_lab_templates():
    """
    Danh sách các khuôn mẫu (Templates) ý tưởng chế tạo Agent phổ biến.
    """
    return [
        {
            "id": "pdf_analyst",
            "title": "Chuyên gia Phân tích PDF & Dữ liệu",
            "goal": "Tạo ra agent phân tích tài liệu PDF: bóc tách bảng số liệu, tóm tắt nội dung chính và trích xuất chỉ số",
            "category": "Document AI",
            "icon": "FileText",
            "recommended_model": "gemini-2.5-flash-lite",
            "color": "#6366f1"
        },
        {
            "id": "code_auditor",
            "title": "Kỹ sư Kiểm toán & Review Code",
            "goal": "Tạo ra agent kiểm toán mã nguồn: quét lỗi bảo mật OWASP, phát hiện memory leak và tối ưu hiệu năng",
            "category": "Engineering",
            "icon": "Code",
            "recommended_model": "deepseek-coder",
            "color": "#ec4899"
        },
        {
            "id": "crypto_researcher",
            "title": "Nhà Phân tích Thị trường Crypto & Onchain",
            "goal": "Tạo ra agent tra cứu biến động giá coin, phân tích dòng tiền ví cá voi và cảnh báo biến động",
            "category": "Finance",
            "icon": "TrendingUp",
            "recommended_model": "gemini-2.5-flash",
            "color": "#10b981"
        },
        {
            "id": "customer_support",
            "title": "Trợ lý Chăm sóc Khách hàng Tự động",
            "goal": "Tạo ra agent CSKH tự động: tiếp nhận khiếu nại, phân loại mức độ khẩn cấp và tra cứu chính sách hoàn tiền",
            "category": "Customer Support",
            "icon": "Headphones",
            "recommended_model": "gemini-2.5-flash-lite",
            "color": "#f59e0b"
        }
    ]


@router.post("/generate")
def generate_agent_in_lab(
    payload: GenerateAgentRequest,
    db: Session = Depends(get_db)
):
    """
    Kích hoạt chu trình chế tạo Agent tự động trong Phòng thí nghiệm 3D:
    - Bước 1: Manager Lead phân rã mục tiêu & thiết kế kiến trúc
    - Bước 2: Search Researcher khảo sát thư viện & tài liệu liên quan
    - Bước 3: Summarizer Specialist thiết kế System Prompt & Lược đồ Tool
    - Bước 4: Python Coder sinh code Tool & Chạy thử trong Sandbox an toàn
    - Bước 5: Triển khai & Ghi nhận Agent vào cơ sở dữ liệu
    """
    if not payload.goal or not payload.goal.strip():
        raise HTTPException(status_code=400, detail="Mục tiêu chế tạo Agent không được để trống")

    result = agent_lab_service.synthesize_agent(
        db=db,
        user_goal=payload.goal.strip(),
        target_model=payload.target_model,
        save_to_db=payload.save_to_db if payload.save_to_db is not None else True
    )
    return result


@router.get("/generated-files")
def list_generated_files():
    """
    Liệt kê toàn bộ các file mã nguồn và cấu hình đã được sinh tự động
    trong các thư mục tools/, prompts/, models/, agents/.
    """
    from app.services.agent_file_generator import agent_file_generator
    return agent_file_generator.list_all_generated()

