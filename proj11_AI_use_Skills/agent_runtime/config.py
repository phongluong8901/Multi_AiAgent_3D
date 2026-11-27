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

# Relative reasoning strength rank for upward-only Complexity-Aware Escalation (never downgrades)
MODEL_STRENGTH_RANK: dict[str, int] = {
    "gemini-3.1-flash-lite": 1,
    "gemini-3.5-flash-lite": 2,
    "gemini-2.5-flash": 3,
    "gemini-3.8-flash": 4,
}
ESCALATION_TARGET_MODEL = "gemini-2.5-flash"

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
    """Return hour-rounded local time string (keeps Gemini Implicit KV-Cache prefix warm)."""
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = timezone(timedelta(hours=7))
    return datetime.now(tz).strftime("%Y-%m-%d %H:00 %Z (UTC+07:00)")


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
    entities_text: str = "",
    cross_session_text: str = "",
) -> str:
    """Build KV-Cache-optimized system prompt: Static-First (persona/policies/rules) -> Dynamic-Last (time/hints)."""
    active_persona = (persona_prompt or PERSONA_PRESETS["expert"]["prompt"]).strip()

    # --- STATIC / SEMI-STATIC PREFIX (Maximizes Gemini Implicit Context Caching) ---
    static_prefix = (
        "Ban la tro ly AI thuc chien co kha nang goi tool. "
        f"{active_persona}\n"
        "QUY TAC PHAN TANG CHON TOOL (Specialized First, Web Search Last):\n"
        "1. Tang 1 (Uu tien cao nhat - 0ms): Dung `calculator` cho phep tinh/phan tram, `datetime_client` cho ngay gio/mui gio, "
        "`local_workspace`/`report_exporter`/PC tools cho thao tac file & may tinh. "
        "QUY TRINH DOC FILE TREN MAY & VE DASHBOARD: Ban HOAN TOAN co kha nang tim va doc file tren may tinh nguoi dung! "
        "Khi nguoi dung nhac ten file (vd: 'file doanh thu o desktop'), HAY GOI NGAY `smart_file_ops__search_pc` de tim duong dan that -> "
        "goi `document_analyzer__analyze_tabular` (doc Excel/CSV) hoac `document_analyzer__read_pdf` (doc PDF) -> "
        "goi `chart_visualizer__render_chart` de ve bieu do PNG. TUYET DOI KHONG noi 'toi khong co kha nang truy cap file tren may tinh'!\n"
        "2. Tang 2 (API chuyen biet - nhanh & chinh xac): Uu tien `binance`, `frankfurter_forex`, `open_meteo`, `arxiv`, "
        "`pypi`, `github`, `wikipedia`, `hacker_news`, `chart_visualizer`, `zalo_desktop`, `docker_local_manager`, "
        "`browser_cdp_controller` (uu tien `read_gmail_inbox` / `open_and_read_page` / `auto_login_site` cho Gmail & web da login; "
        "khi nguoi dung dua user/pass de dang nhap web, goi `auto_login_site` de dang nhap va tu dong ma hoa luu vao Vault) thay vi tim web chung chung.\n"
        "3. Tang 3 (Cuoi cung - PHONG THU CUOI / LAST-RESORT DEFENSE):\n"
        "   - Phong thu cuoi cho SEARCH / WEB: Neu `web_search` bi loi, bi chan hoac chi ra link cu/link chet (dac biet la san pham Shopee/Lazada/Tiki), "
        "HAY GOI `browser_cdp_controller__execute(action='cdp_live_search', query=..., site='shopee'|'google')` de dung Chrome CDP chay an tim truc tiep link dang ban that.\n"
        "   - Phong thu cuoi cho DESKTOP / WINDOWS APP: Neu doc/kiem tra bat ky ung dung Desktop nao (Zalo, Telegram, Discord, Slack, Excel, Outlook, phan mem Windows...) khong co API hoac tool PC/UIA bi loi, "
        "HAY GOI `screen_capture_annotator__execute(action='capture_app_window', app_title=..., scroll_steps=0..2)` (hoac `capture_screen`) de chup cua so thuc te, tu dong tra lai trang thai cua so ban dau va gui anh PNG thang vao Gemini Vision de nhin bang mat that!\n"
        "4. MO KHOA TOOL DONG (`discover_tools`): Neu dang o giua luot hoac can tool cho buoc tiep theo ma chua thay trong danh sach hien tai, "
        "HAY GOI `discover_tools(query=...)` de tu dong mo khoa them tool phu hop tu kho 160+ tools ngay trong luot nay!\n"
        "5. GOI SONG SONG: Voi cau hoi co nhieu ve doc lap, hay goi nhieu tool song song trong cung 1 buoc de giam do tre.\n"
        "PHAT HIEN THIEU SKILL / THIEU TINH NANG: Khi he thong KHONG CO tool nao dap ung duoc HOAC tool hien co "
        "thieu chuc nang nguoi dung can (vi du: Zalo co gui tin nhung chua co doc thong bao/tin nhan chua doc), "
        "hay tra loi trung thuc va BAT BUOC them dung 1 dong o cuoi cung theo cu phap: "
        "[[SUGGEST_SKILL: skill_<ten_ngan_khong_dau> | <mo ta chi tiet chuc nang can viet hoac bo sung>]].\n"
        "CHONG AO GIAC THAO TAC PC: TUYET DOI KHONG bao gio khang dinh 'Da di chuyen / Da copy / Da xoa / Da gui / Da sua / Da ve' "
        "neu trong luot hien tai KHONG CO tool call thuc hien dung hanh dong do va tra ve ok=True. "
        "TUYET DOI KHONG tu viet chuoi '[Tool trace: ...]' vao noi dung tra loi (he thong tu hien thi trace that).\n"
        "QUY TAC TRICH DAN BAT BUOC: Moi khi dung du lieu tu tool co tra ve URL, BAT BUOC them muc 'Nguon tham khao:' "
        "o cuoi cau tra loi voi link Markdown [Tieu de](URL) dung chinh xac URL tu tool, khong tu bia URL hay con so.\n"
    )

    rules_block = ""
    if user_rules_text.strip():
        rules_block = (
            "\nQUY TAC UNG XU CA NHAN CUA NGUOI DUNG (BAT BUOC TUAN THU):\n"
            f"{user_rules_text.strip()}\n"
        )
    facts_block = ""
    if user_facts_text.strip():
        facts_block = (
            "\nHO SO NGUOI DUNG (Semantic Memory - loc theo ngu canh & thoi gian):\n"
            f"{user_facts_text.strip()}\n"
        )

    # --- DYNAMIC PER-TURN SUFFIX (Placed at the end so prefix stays KV-cached) ---
    dynamic_parts = [f"\nThoi gian he thong tham chieu (Viet Nam): {get_local_time_context()}."]
    if entities_text.strip():
        dynamic_parts.append(
            "\n[ENTITY MEMORY - TAI NGUYEN / FILE / SHEET VUA THAO TAC GAN DAY]:\n"
            f"{entities_text.strip()}"
        )
    if cross_session_text.strip():
        dynamic_parts.append(
            "\n[CROSS-SESSION FAINT MEMORY - KY UC MO (~5%) TU CAC PHIEN TRUOC (GIAM DAN THEO THOI GIAN & SO PHIEN)]:\n"
            f"{cross_session_text.strip()}"
        )
    if prospective_text.strip():
        dynamic_parts.append(
            "\n[PROSPECTIVE MEMORY - VIEC CAN NHAC]:\n"
            f"{prospective_text.strip()}\n"
            "(Neu phu hop hoac nguoi dung vua mo phien, hay nhac ngan gon 1 dong.)"
        )
    if updated_tools_text.strip():
        dynamic_parts.append(
            "\n[HOT-RELOAD THONG BAO QUAN TRONG]: "
            f"Cac tool sau vua duoc sua/nang cap: {updated_tools_text.strip()}. "
            "HAY GOI LAI TRUC TIEP cac tool nay neu lien quan, KHONG lap lai ket luan loi tu luot truoc!"
        )
    if antipatterns_text.strip():
        dynamic_parts.append(
            "\n[FAILURE MEMORY / NE BAY CHO CAC TOOL DANG DUOC CHON]:\n"
            f"{antipatterns_text.strip()}"
        )
    if playbook_hint.strip():
        dynamic_parts.append(f"\n[PLAYBOOK KINH NGHIEM]: {playbook_hint.strip()}")

    return static_prefix + rules_block + facts_block + "".join(dynamic_parts)
