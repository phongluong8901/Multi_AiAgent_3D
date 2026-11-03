import httpx
from typing import cast
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from ..core.config import settings
from ..memory.long_term import long_memory
from ..memory.short_term import short_memory

llm = ChatGoogleGenerativeAI(model=settings.FAST_MODEL, google_api_key=settings.GOOGLE_API_KEY, temperature=0.1)

class ExtractedLearning(BaseModel):
    facts_to_remember: list[str] = Field(description="Các sự kiện, kiến thức thực tế, thông tin cá nhân của user đáng lưu trữ lâu dài (Viết thành câu khẳng định độc lập, rõ nghĩa).")
    topic: str = Field(description="Chủ đề chính của kiến thức này")
    self_improvement_lesson: str = Field(description="Bài học rút ra về cách giải quyết yêu cầu này hoặc cách đặt từ khóa tìm kiếm tốt hơn cho lần sau (Bỏ trống nếu câu hỏi quá đơn giản).")

async def notify_gateway_memory_updated():
    """Gửi webhook tới Gateway để Socket.IO phát sóng realtime tới tất cả Frontend clients"""
    gateway_url = settings.GATEWAY_INTERNAL_URL.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(f"{gateway_url}/api/internal/memory-updated")
    except Exception:
        pass

async def background_continual_learning(session_id: str, query: str, web_results: str, final_answer: str):
    """Hàm chạy ngầm sau khi đã trả lời user để AI tự tiêu hóa kiến thức"""
    # 1. Lưu vào bộ nhớ ngắn hạn (Redis)
    await short_memory.add_message(session_id, "user", query)
    await short_memory.add_message(session_id, "assistant", final_answer)

    # 2. Dùng Gemini trích xuất tinh hoa (Tri thức + Kinh nghiệm) để đưa vào Qdrant
    extractor = llm.with_structured_output(ExtractedLearning)
    prompt = f"""
    Phân tích ca làm việc vừa rồi của AI để trích xuất kiến thức lưu vào Bộ nhớ dài hạn:
    - Câu hỏi của User: {query}
    - Thông tin tìm được từ Web: {web_results}
    - Câu trả lời của AI: {final_answer}
    
    Chỉ trích xuất những thông tin thực sự có giá trị sử dụng lại trong tương lai (sự kiện, số liệu, định nghĩa, hoặc sở thích/thông tin của chính user).
    """
    try:
        raw_learned = await extractor.ainvoke(prompt)
        if isinstance(raw_learned, ExtractedLearning):
            learned = raw_learned
        elif isinstance(raw_learned, dict):
            learned = ExtractedLearning.model_validate(raw_learned)
        else:
            learned = cast(ExtractedLearning, raw_learned)
        
        for fact in learned.facts_to_remember:
            long_memory.upsert_knowledge(fact=fact, topic=learned.topic, source="continual_learning")
            
        if learned.self_improvement_lesson and len(learned.self_improvement_lesson) > 15:
            long_memory.save_experience(lesson=learned.self_improvement_lesson, task_type=learned.topic)
            
        # Thông báo tới Gateway qua Socket.IO để tự động cập nhật UI realtime
        await notify_gateway_memory_updated()
            
    except Exception as e:
        print(f"[Self-Learning Error]: {e}")
