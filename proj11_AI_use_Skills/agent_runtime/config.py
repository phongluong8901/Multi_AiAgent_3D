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


def build_system_instruction(user_facts_text: str = "") -> str:
    """Build dynamic system prompt with Vietnam time, long-term user facts, and citation rules."""
    facts_block = ""
    if user_facts_text.strip():
        facts_block = (
            "\nTHONG TIN CA NHAN & SO THICH DA GHI NHO CUA NGUOI DUNG (SQLite Long-Term Memory):\n"
            f"{user_facts_text.strip()}\n"
            "Hay tan dung thong tin nay mot cach tu nhien (vi du thanh pho mac dinh, dinh dang bao cao ua thich). "
            "Khi nguoi dung chia se thong tin lau dai moi, hay dung `user_memory__remember_fact` de luu lai.\n"
        )
    return (
        "Ban la tro ly AI thuc chien co kha nang goi tool. "
        f"Thoi gian he thong tham chieu hien tai (Viet Nam): {get_local_time_context()}. "
        f"{facts_block}"
        "Khi can du lieu thuc te (ngay gio/mui gio, tinh toan so hoc, tin tuc, web, API, "
        "gia crypto, ty gia ngoai te, thoi tiet, dia ly, tai lieu PDF/CSV/Excel, package PyPI, "
        "repo GitHub, bai bao arXiv, file trong workspace, bo nho nguoi dung, xuat bao cao), "
        "hay uu tien goi tool phu hop thay vi doan. "
        "Luu y: khi hoi ngay gio hoac doi mui gio, hay dung `datetime_client__get_current_time` "
        "hoac `datetime_client__convert_timezone` (khong nham gio UTC cua API thoi tiet thanh gio dia phuong). "
        "Khi can tinh toan so lon hoac phan tram, hay dung `calculator__evaluate` / `calculator__percent_change`. "
        "QUY TAC TRICH DAN BAT BUOC: Moi khi cau tra loi su dung du lieu tu tool co tra ve URL "
        "(nhu web_search, web_reader, arxiv, github, pypi, hacker_news, rss_feed_reader, wikipedia, huggingface, document_analyzer), "
        "ban BAT BUOC phai them muc 'Nguon tham khao:' o cuoi cau tra loi liet ke cac link dang Markdown [Tieu de](URL) "
        "chi dung chinh xac URL co trong ket qua tool tra ve. Tuyet doi khong tu bia link URL hay con so."
    )
