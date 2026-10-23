from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter(prefix="/models", tags=["models"])

AVAILABLE_MODELS: List[Dict[str, Any]] = [
    # --- GOOGLE GEMINI ---
    {
        "id": "gemini-2.5-flash-lite",
        "name": "Gemini 2.5 Flash Lite",
        "provider": "Google AI",
        "type": "cloud",
        "description": "Siêu nhanh, phản hồi tức thì, tiết kiệm token, tối ưu cho điều phối & tìm kiếm",
        "contextWindow": "1M tokens",
    },
    {
        "id": "gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "provider": "Google AI",
        "type": "cloud",
        "description": "Thông minh, xử lý đa năng, hỗ trợ tool calling sâu và logic nghiệp vụ phức tạp",
        "contextWindow": "1M tokens",
    },
    {
        "id": "gemini-2.0-flash",
        "name": "Gemini 2.0 Flash",
        "provider": "Google AI",
        "type": "cloud",
        "description": "Bản Flash thế hệ 2, cân bằng giữa tốc độ và khả năng phân tích",
        "contextWindow": "1M tokens",
    },
    {
        "id": "gemini-1.5-flash",
        "name": "Gemini 1.5 Flash",
        "provider": "Google AI",
        "type": "cloud",
        "description": "Độ ổn định cao, dự phòng tin cậy cho toàn bộ workflow",
        "contextWindow": "1M tokens",
    },
    {
        "id": "gemini-1.5-pro",
        "name": "Gemini 1.5 Pro",
        "provider": "Google AI",
        "type": "cloud",
        "description": "Mô hình suy luận chuyên sâu, ngữ cảnh 2 triệu token, phân tích báo cáo lớn",
        "contextWindow": "2M tokens",
    },
    # --- OPENAI ---
    {
        "id": "gpt-4o",
        "name": "GPT-4o (Omni)",
        "provider": "OpenAI",
        "type": "cloud",
        "description": "Mô hình đa phương thức mạnh mẽ nhất của OpenAI, xử lý logic và hình ảnh",
        "contextWindow": "128K tokens",
    },
    {
        "id": "gpt-4o-mini",
        "name": "GPT-4o Mini",
        "provider": "OpenAI",
        "type": "cloud",
        "description": "Mô hình gọn nhẹ, phản hồi nhanh, chi phí siêu tiết kiệm",
        "contextWindow": "128K tokens",
    },
    # --- DEEPSEEK ---
    {
        "id": "deepseek-chat",
        "name": "DeepSeek-V3",
        "provider": "DeepSeek",
        "type": "cloud",
        "description": "Mô hình ngôn ngữ MoE mã nguồn mở hiệu năng cao, chi phí cực rẻ",
        "contextWindow": "64K tokens",
    },
    {
        "id": "deepseek-reasoner",
        "name": "DeepSeek-R1 (Reasoning)",
        "provider": "DeepSeek",
        "type": "cloud",
        "description": "Mô hình suy luận theo chuỗi tư duy (CoT), chuyên biệt giải toán & code phức tạp",
        "contextWindow": "64K tokens",
    },
    # --- ANTHROPIC ---
    {
        "id": "claude-3-5-sonnet",
        "name": "Claude 3.5 Sonnet",
        "provider": "Anthropic",
        "type": "cloud",
        "description": "Khả năng viết code xuất sắc, phân tích văn phong tự nhiên cao cấp",
        "contextWindow": "200K tokens",
    },
    # --- LOCAL OLLAMA (ON-PREMISE) ---
    {
        "id": "llama3.2:1b",
        "name": "Llama 3.2 (1B - Local)",
        "provider": "Ollama Local",
        "type": "local_ollama",
        "description": "Chạy cục bộ trên máy tính người dùng, cực nhẹ (1.3GB), không tốn chi phí API",
        "contextWindow": "128K tokens",
    },
    {
        "id": "llama3.2:3b",
        "name": "Llama 3.2 (3B - Local)",
        "provider": "Ollama Local",
        "type": "local_ollama",
        "description": "Cân bằng tốc độ và chất lượng suy luận, chạy trên RAM 8GB",
        "contextWindow": "128K tokens",
    },
    {
        "id": "qwen2.5:1.5b",
        "name": "Qwen 2.5 (1.5B - Local)",
        "provider": "Ollama Local",
        "type": "local_ollama",
        "description": "Rất giỏi tiếng Việt và toán học/lập trình (1.1GB), chạy offline",
        "contextWindow": "32K tokens",
    },
    {
        "id": "deepseek-r1:1.5b",
        "name": "DeepSeek R1 (1.5B - Local)",
        "provider": "Ollama Local",
        "type": "local_ollama",
        "description": "Suy luận reasoning offline ngay trên máy tính của bạn",
        "contextWindow": "32K tokens",
    },
]

@router.get("", response_model=List[Dict[str, Any]])
def list_available_models():
    """Lấy danh sách các mô hình AI có sẵn (Cloud + Local) để tạo và cấu hình Agent"""
    return AVAILABLE_MODELS
