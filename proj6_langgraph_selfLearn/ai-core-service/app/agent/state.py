"""
Module dinh nghia State cua Agent trong do thi LangGraph (`state.py`).
Dai dien cho toan bo trang thai thuc thi, bo nho, ket qua tim kiem va vet suy luan qua tung node.
"""

from typing_extensions import TypedDict


class AgentState(TypedDict, total=False):
    """
    Trang thai cua do thi tu hoc LangGraph (AgentState):
    - session_id: Ma dinh danh phien hoi thoai
    - query: Cau hoi hoac yeu cau goc tu nguoi dung
    - chat_history: Lich su cac luot hoi thoai gan nhat
    - recalled_knowledge: Tri thuc duoc truy xuat tu Vector Database (Semantic Memory)
    - recalled_experiences: Kinh nghiem thanh cong/that bai truoc day (Episodic Memory)
    - needs_web_search: Co danh dau can truy van Internet qua Web Search hay khong
    - search_queries: Danh sach tu khoa tim kiem do Agent tao ra
    - web_results: Ket qua tong hop tu Web Search
    - final_answer: Cau tra loi hoan thien sau cung
    - critique_score: Diem so tu danh gia / phan bien chat luong (thang diem 1-10)
    - critique_feedback: Nhan xet chi tiet ve diem can cai thien
    - iteration_count: So luot Agent tu lap va sua loi
    - reasoning_trace: Danh sach cac buoc suy luan (Thinking Trace) de truyen phat ve UI
    """
    session_id: str
    query: str
    chat_history: list[dict]
    recalled_knowledge: list[str]
    recalled_experiences: list[str]
    needs_web_search: bool
    search_queries: list[str]
    web_results: str
    final_answer: str
    critique_score: int          # Diem tu phan bien (1-10)
    critique_feedback: str       # Nhan xet danh gia cau tra loi
    iteration_count: int         # Dem so lan tu sua cau tra loi
    reasoning_trace: list[str]   # Dau vet chuoi suy luan hien thi len UI realtime
