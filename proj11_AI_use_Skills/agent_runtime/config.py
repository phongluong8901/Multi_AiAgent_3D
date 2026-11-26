"""Centralized configuration, paths, model fallback chain, and system prompts."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

BASE_DIR = Path(__file__).resolve().parent.parent
SKILLS_ROOT = BASE_DIR / "skills"
OUTPUTS_DIR = BASE_DIR / "outputs"
DATA_DIR = BASE_DIR / "data"
ENV_FILE = BASE_DIR / ".env"

DEFAULT_MODEL = "gemini-3.5-flash-lite"
DEFAULT_TOP_K = 6
DEFAULT_MAX_STEPS = 8
DEFAULT_API_TIMEOUT_SEC = 45
DEFAULT_TOOL_TIMEOUT_SEC = 30
DEFAULT_COMPACT_TOKEN_THRESHOLD = 10_000
DEFAULT_KEEP_RECENT_TURNS = 3

FALLBACK_MODELS: tuple[str, ...] = (
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.8-flash",
)

# Low-level internal/infrastructure modules excluded from LLM tool declarations
SKIP_MODULES: frozenset[str] = frozenset(
    {
        "skill_circular_buffer",
        "skill_event_processor",
        "skill_event_queue",
        "skill_thread_pool",
        "skill_url_deduplicator_processor",
        "skill_url_filter",
        "skill_url_normalizer",
        "skill_url_normalizer_filter_pipeline",
        "skill_url_processor_pipeline",
        "skill_html_content_extractor",
        "skill_html_noise_filter",
        "skill_json_schema_validator",
    }
)

BENCHMARK_PROMPTS: tuple[tuple[str, str], ...] = (
    (
        "Crypto, Forex (VND) & Calculator",
        "Lay gia BTCUSDT hien tai tren Binance, ty gia 1 USD sang VND moi nhat, roi dung calculator tinh gia 1 BTC ra VND.",
    ),
    (
        "DateTime & Weather (Hanoi)",
        "Hom nay la thu may, may gio tai Ha Noi va thoi tiet hien tai o Ha Noi the nao?",
    ),
    (
        "Dev & Research APIs",
        "Tra cuu thong tin package httpx tren PyPI va tim 2 bai bao moi tren arXiv ve 'self-evolving agents'.",
    ),
    (
        "PDF Document Analyzer",
        "Doc 2 trang dau cua bai bao https://arxiv.org/pdf/2508.07407.pdf va tom tat muc tieu chinh trong 3 gach dau dong.",
    ),
    (
        "Web Search",
        "Tim thong tin moi nhat ve Python 3.14 tren web kem link nguon.",
    ),
)


def get_local_time_context(tz_name: str = "Asia/Ho_Chi_Minh") -> str:
    """Return formatted local time string for system instruction grounding."""
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = timezone(timedelta(hours=7))
    return datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S %Z (UTC+07:00)")


PERSONA_PRESETS: dict[str, dict[str, str]] = {
    "expert": {
        "label": "Chuyên gia kỹ thuật (Mặc định)",
        "prompt": (
            "Phong cách trả lời: Chuyên gia kỹ thuật cao cấp (Senior Architect / Staff Engineer). "
            "Đi thẳng vào trọng tâm, sắc bén, chính xác, ưu tiên số liệu thực tế, bảng so sánh và code sạch. "
            "Không nói vòng vo, không dùng emoji, chủ động chỉ ra trade-off và điểm cần lưu ý."
        ),
    },
    "concise": {
        "label": "Siêu ngắn gọn (Tối giản)",
        "prompt": (
            "Phong cách trả lời: Tối giản, chỉ gạch đầu dòng kết quả chính, con số và lệnh thực thi. "
            "Bỏ qua mọi lời mở đầu và kết luận thừa."
        ),
    },
    "mentor": {
        "label": "Cố vấn / Giải thích bản chất",
        "prompt": (
            "Phong cách trả lời: Cố vấn kỹ thuật tận tình. Giải thích rõ bản chất vấn đề, "
            "lý do chọn giải pháp, ưu/nhược điểm từng phương án để người dùng hiểu sâu và tự chủ."
        ),
    },
    "custom": {
        "label": "Tùy chỉnh (Tự viết Prompt)",
        "prompt": "",
    },
}


def build_system_instruction(
    user_facts_text: str = "",
    playbook_hint: str = "",
    user_rules_text: str = "",
    persona_prompt: str = "",
    antipatterns_text: str = "",
    prospective_text: str = "",
    updated_tools_text: str = "",
) -> str:
    """Build dynamic system prompt with persona, Vietnam time, Memory OS layers, playbook, and citations."""
    active_persona = (persona_prompt or PERSONA_PRESETS["expert"]["prompt"]).strip()
    facts_block = ""
    if user_facts_text.strip():
        facts_block = (
            "\nHO SO NGUOI DUNG (SQLite Semantic Memory - uu tien theo do quan trong & thoi gian):\n"
            f"{user_facts_text.strip()}\n"
        )
    rules_block = ""
    if user_rules_text.strip():
        rules_block = (
            "\nQUY TAC UNG XU CA NHAN CUA NGUOI DUNG (BAT BUOC TUAN THU):\n"
            f"{user_rules_text.strip()}\n"
        )
    prospective_block = ""
    if prospective_text.strip():
        prospective_block = (
            "\n[PROSPECTIVE MEMORY - VIEC CAN NHAC / BACKLOG DANG KICH HOAT]:\n"
            f"{prospective_text.strip()}\n"
            "(Neu phu hop hoac nguoi dung vua mo phien, hay nhac ngan gon 1 dong.)\n"
        )
    updated_block = ""
    if updated_tools_text.strip():
        updated_block = (
            "\n[HOT-RELOAD THONG BAO QUAN TRONG]: "
            f"Cac tool sau vua duoc nguoi dung sua/nang cap phien ban code moi: {updated_tools_text.strip()}. "
            "HAY GOI LAI TRUC TIEP cac tool nay neu cau hoi lien quan, TUYET DOI KHONG dung lai ket luan loi tu cac luot chat truoc!\n"
        )
    antipatterns_block = ""
    if antipatterns_text.strip():
        antipatterns_block = (
            "\n[FAILURE MEMORY / NE BAY CHO CAC TOOL DANG DUOC CHON]:\n"
            f"{antipatterns_text.strip()}\n"
        )
    playbook_block = ""
    if playbook_hint.strip():
        playbook_block = f"\n[PLAYBOOK KINH NGHIEM]: {playbook_hint.strip()}\n"

    return (
        "Ban la tro ly AI thuc chien co kha nang goi tool. "
        f"{active_persona}\n"
        f"Thoi gian he thong tham chieu hien tai (Viet Nam): {get_local_time_context()}. "
        f"{facts_block}"
        f"{rules_block}"
        f"{prospective_block}"
        f"{updated_block}"
        f"{antipatterns_block}"
        f"{playbook_block}"
        "QUY TAC PHAN TANG CHON TOOL (Specialized First, Web Search Last):\n"
        "1. Tang 1 (Uu tien cao nhat - 0ms): Dung `calculator` cho phep tinh/phan tram, `datetime_client` cho ngay gio/mui gio, "
        "`local_workspace`/`report_exporter`/PC tools cho thao tac file & may tinh.\n"
        "2. Tang 2 (API chuyen biet - nhanh & chinh xac): Uu tien `binance`, `frankfurter_forex`, `open_meteo`, `arxiv`, "
        "`pypi`, `github`, `wikipedia`, `hacker_news` thay vi tim web chung chung.\n"
        "3. Tang 3 (Cuoi cung): CHI dung `web_search` -> `web_reader` -> `browser_reader` khi Tang 1 & 2 khong ho tro hoac bi loi. "
        "Neu 1 tool chinh bi loi (ERR), hay thu sang tool du phong (backup tool) duoc he thong mo khoa.\n"
        "PHAT HIEN THIEU SKILL: Neu nguoi dung yeu cau thao tac truc tiep (doc RAM/CPU, chup man hinh, dieu khien he thong, "
        "API chuyen biet...) ma trong danh sach tool hien tai KHONG CO tool nao dap ung duoc, hay tra loi trung thuc va "
        "them dung 1 dong o cuoi cung theo cu phap: [[SUGGEST_SKILL: skill_<ten_ngan_khong_dau> | <mo ta chi tiet chuc nang can viet>]].\n"
        "QUY TAC TRICH DAN BAT BUOC: Moi khi dung du lieu tu tool co tra ve URL, BAT BUOC them muc 'Nguon tham khao:' "
        "o cuoi cau tra loi voi link Markdown [Tieu de](URL) dung chinh xac URL tu tool, khong tu bia URL hay con so."
    )
