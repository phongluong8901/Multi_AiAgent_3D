"""
Background Continual Learning Pipeline.
Analyzes conversational exchanges post-response, extracts high-value facts and lessons,
upserts memories into Qdrant, updates Redis short-term cache, and notifies Gateway via webhook.
"""

import httpx
from typing import cast
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from ..core.config import settings
from ..memory.long_term import long_memory
from ..memory.short_term import short_memory

# LLM instance initialized for low-temperature structured knowledge extraction
llm = ChatGoogleGenerativeAI(
    model=settings.FAST_MODEL,
    google_api_key=settings.GOOGLE_API_KEY,
    temperature=0.1
)

class ExtractedLearning(BaseModel):
    """
    Schema for structured extraction of facts, topical tags, and self-improvement lessons
    distilled from the conversation turn.
    """
    facts_to_remember: list[str] = Field(
        default_factory=list,
        description="Danh sách dữ kiện, số liệu, thông tin cá nhân thực sự mới đáng lưu. Nếu không có gì mới hoặc chỉ là chào hỏi/xã giao thì trả về danh sách rỗng []."
    )
    topic: str = Field(default="", description="Chủ đề chính của kiến thức này")
    self_improvement_lesson: str = Field(
        default="",
        description="Bài học rút ra về cách đặt từ khóa hoặc cách giải quyết vấn đề. Bỏ trống nếu không có bài học thực sự giá trị."
    )

async def notify_gateway_memory_updated():
    """
    Sends an internal webhook trigger to Gateway Service to broadcast realtime
    Socket.IO memory synchronization events to active frontend client dashboards.
    """
    gateway_url = settings.GATEWAY_INTERNAL_URL.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(f"{gateway_url}/api/internal/memory-updated")
    except Exception:
        pass

async def background_continual_learning(session_id: str, query: str, web_results: str, final_answer: str):
    """
    Asynchronous background process executed after delivering the assistant's answer.
    Commits turns to Redis short-term history, prompts LLM for selective fact and lesson extraction,
    stores verified insights in Qdrant, and triggers gateway memory updates.

    Args:
        session_id: Unique chat session identifier.
        query: User input query text.
        web_results: Retrieved external web content, if any.
        final_answer: Assistant generated response text.
    """
    # 1. Append message turn to Redis short-term sliding window
    await short_memory.add_message(session_id, "user", query)
    await short_memory.add_message(session_id, "assistant", final_answer)

    # 2. Extract novel facts and lessons using structured Gemini schema
    extractor = llm.with_structured_output(ExtractedLearning)
    prompt = f"""
    Bạn là bộ phận quản lý tri thức dài hạn của AI Agent.
    Nhiệm vụ: Phân tích ca làm việc vừa rồi để xem có thông tin THỰC SỰ MỚI đáng lưu vào Qdrant hay không:
    - Câu hỏi của User: "{query}"
    - Dữ liệu mới tìm từ Web: "{web_results if web_results else 'Không có (AI dùng tri thức sẵn có)'}"
    - Câu trả lời của AI: "{final_answer}"
    
    QUY TẮC LỌC NGHIÊM NGẶT ĐỂ CHỐNG TRÙNG LẶP VÀ RÁC BỘ NHỚ:
    1. BỎ QUA HOÀN TOÀN (trả về facts_to_remember = []):
       - Các câu chào hỏi xã giao, cảm ơn, đùa vui, câu hỏi thông thường.
       - Các câu hỏi mà AI trả lời dựa trên tri thức sẵn có trong bộ nhớ (tránh việc AI tự học lại chính câu trả lời của mình gây lặp kiến thức).
    2. CHỈ TRÍCH XUẤT KHI:
       - User chia sẻ thông tin cá nhân/sở thích/thông tin công việc hoặc quy định riêng của họ (ví dụ: "tôi tên là...", "dự án của tôi dùng...", "tôi thích...").
       - Có dữ liệu mới thực sự được thu thập từ Web Search.
    3. ĐẶC BIỆT: Không lặp lại các kiến thức đã nói ở câu trước nếu không có chi tiết mới.
    4. Bài học kinh nghiệm (self_improvement_lesson): Chỉ ghi nhận khi có kinh nghiệm tối ưu từ khóa tìm kiếm hoặc kỹ thuật xử lý phức tạp. Nếu câu hỏi đơn giản -> để trống hoàn toàn.
    """
    try:
        raw_learned = await extractor.ainvoke(prompt)
        if isinstance(raw_learned, ExtractedLearning):
            learned = raw_learned
        elif isinstance(raw_learned, dict):
            learned = ExtractedLearning.model_validate(raw_learned)
        else:
            learned = cast(ExtractedLearning, raw_learned)
        
        has_new_updates = False

        # Store newly learned facts into Qdrant knowledge vector collection
        if learned.facts_to_remember:
            for fact in learned.facts_to_remember:
                if fact and len(fact.strip()) > 8:
                    long_memory.upsert_knowledge(fact=fact.strip(), topic=learned.topic or "Tri thức chung", source="continual_learning")
                    has_new_updates = True
            
        # Store procedural or retrieval lessons into Qdrant experience vector collection
        if learned.self_improvement_lesson and len(learned.self_improvement_lesson.strip()) > 15:
            long_memory.save_experience(lesson=learned.self_improvement_lesson.strip(), task_type=learned.topic or "Kinh nghiệm chung")
            has_new_updates = True
            
        # Emit webhook notification to sync frontend dashboard if memory state changed
        if has_new_updates:
            await notify_gateway_memory_updated()
            
    except Exception as e:
        print(f"[Self-Learning Error]: {e}")
