from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter(prefix="/models", tags=["models"])

AVAILABLE_MODELS: List[Dict[str, Any]] = [
    {
        "id": "gemini-2.5-flash-lite",
        "name": "Gemini 2.5 Flash Lite",
        "provider": "Google AI",
        "description": "Siêu nhanh, phản hồi tức thì, tiết kiệm token, tối ưu cho điều phối & tìm kiếm",
    },
    {
        "id": "gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "provider": "Google AI",
        "description": "Thông minh, xử lý đa năng, hỗ trợ tool calling sâu và logic nghiệp vụ phức tạp",
    },
    {
        "id": "gemini-2.0-flash",
        "name": "Gemini 2.0 Flash",
        "provider": "Google AI",
        "description": "Bản Flash thế hệ 2, cân bằng giữa tốc độ và khả năng phân tích",
    },
    {
        "id": "gemini-1.5-flash",
        "name": "Gemini 1.5 Flash",
        "provider": "Google AI",
        "description": "Độ ổn định cao, dự phòng tin cậy cho toàn bộ workflow",
    },
    {
        "id": "gemini-1.5-pro",
        "name": "Gemini 1.5 Pro",
        "provider": "Google AI",
        "description": "Mô hình suy luận chuyên sâu, ngữ cảnh 1 triệu token, phân tích báo cáo lớn",
    },
]

@router.get("", response_model=List[Dict[str, Any]])
def list_available_models():
    """Lấy danh sách các mô hình AI có sẵn để tạo và cấu hình Agent"""
    return AVAILABLE_MODELS
