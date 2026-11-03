from typing import cast
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from ..core.config import settings
from ..memory.short_term import short_memory
from ..memory.long_term import long_memory
from ..tools.web_search import search_the_web
from .state import AgentState

llm = ChatGoogleGenerativeAI(
    model=settings.FAST_MODEL,
    google_api_key=settings.GOOGLE_API_KEY,
    temperature=0.2
)

class KnowledgeEvaluation(BaseModel):
    needs_search: bool = Field(description="True nếu bộ nhớ hiện tại thiếu thông tin hoặc thông tin có thể đã lỗi thời.")
    search_queries: list[str] = Field(description="Tối đa 2 câu lệnh tìm kiếm ngắn gọn bằng tiếng Việt hoặc Anh nếu needs_search=True")
    reason: str = Field(description="Lý do vì sao đủ hoặc thiếu kiến thức")

async def recall_memory_node(state: AgentState) -> dict:
    query = state["query"]
    history = await short_memory.get_history(state["session_id"])
    knowledge = long_memory.recall_knowledge(query)
    experiences = long_memory.recall_experiences(query)
    
    trace = state.get("reasoning_trace", [])
    trace.append(f"[Recall] Tìm thấy {len(knowledge)} tri thức dài hạn & {len(experiences)} kinh nghiệm quá khứ.")
    
    return {
        "chat_history": history,
        "recalled_knowledge": knowledge,
        "recalled_experiences": experiences,
        "reasoning_trace": trace
    }

async def evaluate_knowledge_node(state: AgentState) -> dict:
    structured_llm = llm.with_structured_output(KnowledgeEvaluation)
    
    prompt = f"""
    Bạn là bộ phận đánh giá nhận thức của AI.
    Câu hỏi người dùng: "{state['query']}"
    
    Tri thức dài hạn đang có trong Qdrant:
    {state['recalled_knowledge']}
    
    Kinh nghiệm quá khứ:
    {state['recalled_experiences']}
    
    Hãy đánh giá xem thông tin trong bộ nhớ đã ĐỦ, CHÍNH XÁC và CẬP NHẬT để trả lời câu hỏi chưa.
    Nếu câu hỏi yêu cầu thông tin thực tế, sự kiện mới, hoặc bộ nhớ đang trống -> Bắt buộc bật needs_search = True.
    """
    raw_eval = await structured_llm.ainvoke(prompt)
    if isinstance(raw_eval, KnowledgeEvaluation):
        eval_result = raw_eval
    elif isinstance(raw_eval, dict):
        eval_result = KnowledgeEvaluation.model_validate(raw_eval)
    else:
        eval_result = cast(KnowledgeEvaluation, raw_eval)
    
    trace = state["reasoning_trace"]
    if eval_result.needs_search:
        trace.append(f"[Evaluate] Kiến thức chưa đủ ({eval_result.reason}). Kích hoạt Tavily Search: {eval_result.search_queries}")
    else:
        trace.append(f"[Evaluate] Đã có sẵn tri thức trong Qdrant ({eval_result.reason}). Không cần search web.")
        
    return {
        "needs_web_search": eval_result.needs_search,
        "search_queries": eval_result.search_queries,
        "reasoning_trace": trace
    }

async def web_search_node(state: AgentState) -> dict:
    results = []
    queries = state.get("search_queries", [])
    for q in queries:
        res = await search_the_web(q)
        results.append(f"Query [{q}]:\n{res}")
    
    combined = "\n\n".join(results)
    trace = state["reasoning_trace"]
    trace.append("[Web Search] Đã thu thập dữ liệu mới qua Tavily Search.")
    return {"web_results": combined, "reasoning_trace": trace}

async def synthesize_response_node(state: AgentState) -> dict:
    prompt = f"""
    Bạn là một AI có khả năng tự học và ghi nhớ liên tục.
    
    Lịch sử trò chuyện gần đây: {state['chat_history'][-4:]}
    Kinh nghiệm rút ra từ các lần trước: {state['recalled_experiences']}
    Kiến thức từ Bộ nhớ dài hạn (Qdrant): {state['recalled_knowledge']}
    Dữ liệu mới vừa tìm trên Internet (nếu có): {state.get('web_results', 'Không tìm kiếm')}
    
    Câu hỏi hiện tại: "{state['query']}"
    
    Hãy tổng hợp thông tin và trả lời thật rõ ràng, chính xác.
    """
    response = await llm.ainvoke(prompt)
    trace = state["reasoning_trace"]
    trace.append("[Respond] Đã tổng hợp câu trả lời hoàn chỉnh.")
    return {"final_answer": response.content, "reasoning_trace": trace}
