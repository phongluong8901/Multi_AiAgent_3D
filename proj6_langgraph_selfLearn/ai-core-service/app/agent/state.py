from typing_extensions import TypedDict

class AgentState(TypedDict, total=False):
    session_id: str
    query: str
    chat_history: list[dict]
    recalled_knowledge: list[str]
    recalled_experiences: list[str]
    needs_web_search: bool
    search_queries: list[str]
    web_results: str
    final_answer: str
    critique_score: int          # Điểm tự phản biện (1-10)
    critique_feedback: str       # Nhận xét đánh giá câu trả lời
    iteration_count: int         # Đếm số lần tự sửa câu trả lời
    reasoning_trace: list[str]   # Dấu vết chuỗi suy luận hiển thị lên UI realtime
