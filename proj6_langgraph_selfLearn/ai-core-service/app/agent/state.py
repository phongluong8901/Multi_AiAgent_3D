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
    reasoning_trace: list[str]  # Luu lai dau vet suy nghi de hien thi len UI
