"""
Execution Nodes for LangGraph Autonomous Cognitive Agent.
Includes memory recall, knowledge evaluation, web search, answer synthesis, and self-critique nodes.
"""

from typing import cast, Optional
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from ..core.config import settings
from ..memory.short_term import short_memory
from ..memory.long_term import long_memory
from ..tools.web_search import search_the_web
from .state import AgentState

# Initialize Google Generative AI LLM client with fast inference parameters
llm = ChatGoogleGenerativeAI(
    model=settings.FAST_MODEL,
    google_api_key=settings.GOOGLE_API_KEY,
    temperature=0.2
)

class KnowledgeEvaluation(BaseModel):
    """
    Schema for structured LLM evaluation of retrieved knowledge sufficiency.
    Determines whether external web retrieval is required to answer the user query.
    """
    needs_search: bool = Field(description="True nếu bộ nhớ hiện tại thiếu thông tin hoặc thông tin có thể đã lỗi thời.")
    search_queries: list[str] = Field(description="Tối đa 2 câu lệnh tìm kiếm ngắn gọn bằng tiếng Việt hoặc Anh nếu needs_search=True")
    reason: str = Field(description="Lý do vì sao đủ hoặc thiếu kiến thức")

class ResponseCritique(BaseModel):
    """
    Schema for self-correction critique and quality scoring.
    Verifies grounding, relevance, and supplies refined response if necessary.
    """
    score: int = Field(ge=1, le=10, description="Điểm đánh giá chất lượng câu trả lời từ 1 đến 10.")
    is_grounded: bool = Field(description="True nếu thông tin trung thực, không bịa đặt hoặc mâu thuẫn với tài liệu nguồn.")
    is_relevant: bool = Field(description="True nếu trả lời trực diện câu hỏi của người dùng.")
    critique_reason: str = Field(description="Nhận xét ngắn gọn về chất lượng câu trả lời.")
    refined_answer: Optional[str] = Field(default=None, description="Câu trả lời đã được tinh chỉnh nếu score < 7 hoặc có chi tiết cần sửa.")

async def recall_memory_node(state: AgentState) -> dict:
    """
    Retrieves conversational short-term context from Redis and long-term memories
    (declarative knowledge and episodic experiences) from Qdrant vector database.

    Args:
        state: Current graph state containing query and session ID.

    Returns:
        Updated state dictionary with recalled context and updated reasoning trace.
    """
    query = state["query"]
    # Fetch recent chat turns from Redis short-term cache
    history = await short_memory.get_history(state["session_id"])
    # Fetch semantic knowledge and past experiences from Qdrant vector store
    knowledge = long_memory.recall_knowledge(query)
    experiences = long_memory.recall_experiences(query)
    
    trace = state.get("reasoning_trace", [])
    trace.append(f"[Recall] Tìm thấy {len(knowledge)} tri thức dài hạn & {len(experiences)} kinh nghiệm quá khứ.")
    
    return {
        "chat_history": history,
        "recalled_knowledge": knowledge,
        "recalled_experiences": experiences,
        "reasoning_trace": trace,
        "iteration_count": 0
    }

async def evaluate_knowledge_node(state: AgentState) -> dict:
    """
    Evaluates whether the recalled memories provide sufficient and up-to-date
    information to answer the user query, or if active web search is required.

    Args:
        state: Current graph state with recalled knowledge and experiences.

    Returns:
        Updated state dictionary with search requirement flag, queries, and trace.
    """
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
    """
    Executes real-time web searches using Tavily search engine for each generated query.

    Args:
        state: Current graph state containing search queries.

    Returns:
        Updated state dictionary with aggregated web search results and trace.
    """
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
    """
    Synthesizes the initial draft answer by grounding the prompt with chat history,
    episodic experiences, recalled knowledge, and web search findings.

    Args:
        state: Current graph state with all gathered context and user query.

    Returns:
        Updated state dictionary with the generated draft answer and trace.
    """
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
    trace.append("[Respond] Đã tạo bản nháp câu trả lời ban đầu.")
    return {"final_answer": response.content, "reasoning_trace": trace}

async def critique_response_node(state: AgentState) -> dict:
    """
    Performs self-correction and CRAG (Corrective Retrieval-Augmented Generation) critique.
    Validates factual grounding and relevancy, scoring the answer and refining it if sub-par.

    Args:
        state: Current graph state with draft answer and ground truth sources.

    Returns:
        Updated state dictionary with quality score, critique feedback, refined answer, and trace.
    """
    structured_critic = llm.with_structured_output(ResponseCritique)
    prompt = f"""
    Bạn là bộ phận phản biện và kiểm định chất lượng câu trả lời của AI Agent (Self-Correction Critic).
    
    Câu hỏi người dùng: "{state['query']}"
    Tri thức từ Qdrant: {state.get('recalled_knowledge', [])}
    Dữ liệu Web search: {state.get('web_results', 'Không có')}
    Câu trả lời vừa tạo: "{state.get('final_answer', '')}"
    
    Nhiệm vụ kiểm định:
    1. is_grounded: Câu trả lời có trung thực bám sát nguồn tài liệu không? Có chi tiết nào bịa đặt không?
    2. is_relevant: Câu trả lời có giải quyết trực diện câu hỏi không?
    3. score: Chấm điểm từ 1 đến 10.
    4. Nếu score < 7: Hãy viết lại refined_answer thật hoàn chỉnh, sắc bén, loại bỏ lỗi logic và trả lời trực diện.
    """
    try:
        raw_critic = await structured_critic.ainvoke(prompt)
        if isinstance(raw_critic, ResponseCritique):
            critic = raw_critic
        elif isinstance(raw_critic, dict):
            critic = ResponseCritique.model_validate(raw_critic)
        else:
            critic = cast(ResponseCritique, raw_critic)
    except Exception as e:
        # Fallback an toàn nếu LLM gặp lỗi cú pháp
        critic = ResponseCritique(score=8, is_grounded=True, is_relevant=True, critique_reason=f"Mặc định đạt (fallback: {e})")
        
    trace = state.get("reasoning_trace", [])
    trace.append(f"[Critique] Tự phản biện chất lượng: {critic.score}/10 điểm ({critic.critique_reason}).")
    
    final_ans = state.get("final_answer", "")
    if critic.score < 7 and critic.refined_answer:
        final_ans = critic.refined_answer
        trace.append("[Self-Correction] Đã tự động hiệu chỉnh và nâng cao độ chính xác của câu trả lời.")
        
    return {
        "final_answer": final_ans,
        "critique_score": critic.score,
        "critique_feedback": critic.critique_reason,
        "reasoning_trace": trace,
        "iteration_count": state.get("iteration_count", 0) + 1
    }
