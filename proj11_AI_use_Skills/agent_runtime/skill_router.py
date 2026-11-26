"""Dynamic Skill Router for filtering Gemini FunctionDeclarations per user query.

Designed to keep token usage low and tool selection accurate as the skill library grows
(e.g. from ~30 skills to 100+ skills). Supports Vietnamese (accent-insensitive) and English.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Sequence

from google.genai import types

# Domain keyword expansion (normalized ASCII Vietnamese + English -> skill/tool tokens)
_DOMAIN_HINTS: dict[str, tuple[str, ...]] = {
    "datetime_client": (
        "gio", "may gio", "ngay", "hom nay", "thu may", "mui gio", "timezone",
        "clock", "time", "date", "utc", "gmt", "lich", "weekday",
    ),
    "calculator": (
        "tinh", "tinh toan", "cong", "tru", "nhan", "chia", "phan tram", "lai suat",
        "tang truong", "bieu thuc", "math", "calc", "calculate", "percent", "sqrt", "doi ra",
    ),
    "binance_crypto_client": (
        "btc", "eth", "sol", "bnb", "usdt", "crypto", "bitcoin", "ethereum",
        "coin", "binance", "tien ao", "tien dien tu",
    ),
    "frankfurter_forex_client": (
        "ty gia", "ti gia", "ngoai te", "usd", "vnd", "eur", "jpy", "gbp",
        "forex", "exchange", "currency", "doi tien", "do la",
    ),
    "open_meteo_weather_client": (
        "thoi tiet", "nhiet do", "mua", "nang", "gio", "do am", "weather",
        "temperature", "forecast", "khi hau",
    ),
    "weather_api_client": (
        "thoi tiet", "nhiet do", "weather", "latitude", "longitude", "vi do", "kinh do",
    ),
    "openstreetmap_api_client": (
        "toa do", "ban do", "dia chi", "vi tri", "map", "coordinates", "geocode",
        "latitude", "longitude", "kinh do", "vi do",
    ),
    "ip_geolocation_client": (
        "ip", "dia chi ip", "geolocation", "vi tri ip", "isp", "may chu",
    ),
    "arxiv_api_client": (
        "arxiv", "bai bao", "paper", "nghien cuu", "research", "preprint", "khoa hoc",
    ),
    "github_api_client": (
        "github", "repo", "repository", "ma nguon", "open source", "star", "git",
    ),
    "huggingface_api_client": (
        "huggingface", "hf", "model", "llm", "weights", "checkpoint", "dataset",
    ),
    "pypi_api_client": (
        "pypi", "pip", "package", "thu vien python", "python package", "version",
    ),
    "hacker_news_api_client": (
        "hacker news", "hackernews", "hn", "top stories", "tin cong nghe",
    ),
    "rss_feed_reader": (
        "rss", "feed", "tin moi", "bai viet moi", "news",
    ),
    "wikipedia_api_client": (
        "wikipedia", "wiki", "tieu su", "tra wiki",
    ),
    "document_analyzer": (
        "pdf", "excel", "xlsx", "xls", "csv", "bang du lieu", "tai lieu",
        "trang dau", "doc file", "phan tich bang", "tabular", "dataframe",
    ),
    "report_exporter": (
        "xuat", "export", "luu file", "tao file", "bao cao", "report",
        "xlsx", "excel", "csv", "json", "markdown", ".md",
    ),
    "local_workspace": (
        "thu muc", "workspace", "local", "file trong du an", "outputs",
        "danh sach file", "doc file local", "list files", "project",
    ),
    "user_memory": (
        "ghi nho", "nho giup", "luu thong tin", "so thich", "thong tin ca nhan",
        "mac dinh", "quen di", "xoa ghi nho", "remember", "recall", "forget", "memory", "profile",
    ),
    "provider_model_checker": (
        "groq", "cloudflare", "gemini", "mistral", "danh sach model", "list models", "check model",
        "kiem tra model", "9router", "provider", "api model",
    ),
    # automationPc_skills pack
    "browser_cdp_controller": (
        "chrome", "edge", "cdp", "tab trinh duyet", "9222", "active tab", "list tabs", "debug port",
    ),
    "clipboard_manager": (
        "clipboard", "bo nho tam", "copy", "paste", "dan", "lich su copy", "pyperclip",
    ),
    "office_com_excel": (
        "excel", "xlsx", "sheet", "bang tinh", "com excel", "read_sheet", "write_rows", "live excel",
    ),
    "pc_safety_guard": (
        "kiem tra lenh", "an toan", "powershell", "system32", "safety", "risk", "evaluate_command",
    ),
    "smart_file_ops": (
        "tim file", "sap xep thu muc", "doi ten hang loat", "batch rename", "organize", "glob", "file ops",
    ),
    "win_registry_startup": (
        "startup", "khoi dong cung windows", "registry", "hkcu", "bien moi truong", "env vars", "winreg",
    ),
    "browser_reader": (
        "trinh duyet", "playwright", "dong", "dynamic", "javascript", "spa",
        "css selector", "scrape", "render",
    ),
    "network_inspector": (
        "http", "header", "status code", "redirect", "kiem tra url", "inspect", "ssl", "dns",
    ),
    "web_reader": (
        "doc trang", "doc link", "doc url", "noi dung trang", "read url", "http://", "https://",
    ),
    "web_search": (
        "tim kiem", "tim thong tin", "search", "google", "moi nhat", "tin tuc", "web", "link nguon",
    ),
}

# Always keep these lightweight general-purpose tools available if slots remain
_ALWAYS_INCLUDE_FALLBACKS = (
    "web_search__search",
    "datetime_client__get_current_time",
    "calculator__evaluate",
)


def normalize_text(text: str) -> str:
    """Lowercase and strip Vietnamese diacritics for robust ASCII keyword matching."""
    text = (text or "").replace("đ", "d").replace("Đ", "D")
    nfkd = unicodedata.normalize("NFKD", text)
    ascii_str = "".join(ch for ch in nfkd if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", ascii_str.lower()).strip()


def _tokenize(normalized: str) -> set[str]:
    return set(re.findall(r"[a-z0-9_]+", normalized))


@dataclass(frozen=True)
class _IndexedTool:
    declaration: types.FunctionDeclaration
    name: str
    skill_prefix: str
    meta_tokens: frozenset[str]
    hints: tuple[str, ...]


# Patterns indicating a pure conversational/knowledge prompt that needs ZERO tools
_NO_TOOL_PREFIXES = (
    "xin chao", "chao ban", "chao ", "hello", "hi ", "hey ", "cam on", "thanks", "thank you",
    "dich sang", "dich cau", "translate", "viet email", "viet doan van", "giai thich",
    "so sanh ", "khac nhau giua", "la gi", "tai sao ", "ban la ai", "tom tat doan",
)

_FORCE_TOOL_SIGNALS = (
    "hom nay", "ngay mai", "hien tai", "moi nhat", "bay gio", "may gio", "thu may",
    "http://", "https://", ".pdf", ".xlsx", ".csv", ".py", "outputs",
    "gia ", "ty gia", "ti gia", "thoi tiet", "nhiet do", "toa do", "bitcoin", "btc", "eth", "usd", "vnd",
    "clipboard", "startup", "registry", "chrome", "excel", "thu muc", "tim file", "doi ten", "powershell",
    "xuat file", "luu file", "tao file", "ghi nho", "nho giup", "quen di",
    "arxiv", "github", "pypi", "huggingface", "hacker news", "wikipedia", "ip ",
    "tinh ", "phan tram", "bao nhieu", "kiem tra", "tra cuu", "tim kiem", "search",
)


class SkillRouter:
    """Fast deterministic router with No-Tool Fast Path and top-K tool selection."""

    def __init__(self, declarations: Sequence[types.FunctionDeclaration]):
        self._all: list[types.FunctionDeclaration] = list(declarations)
        self._by_name: dict[str, types.FunctionDeclaration] = {
            d.name: d for d in self._all if d.name
        }
        self._indexed: list[_IndexedTool] = []

        for decl in self._all:
            name = decl.name or ""
            skill_prefix = name.split("__", 1)[0]
            param_names = (
                " ".join((decl.parameters.properties or {}).keys())
                if decl.parameters
                else ""
            )
            meta_str = normalize_text(f"{name.replace('__', ' ').replace('_', ' ')} {decl.description or ''} {param_names}")
            hints = _DOMAIN_HINTS.get(skill_prefix, ())
            self._indexed.append(
                _IndexedTool(
                    declaration=decl,
                    name=name,
                    skill_prefix=skill_prefix,
                    meta_tokens=frozenset(_tokenize(meta_str)),
                    hints=hints,
                )
            )

    @property
    def total_tools(self) -> int:
        return len(self._all)

    def needs_tools(self, query: str) -> bool:
        """Fast-path intent gate: return False for pure chat/writing/concept prompts to save ~90% tokens."""
        norm_q = normalize_text(query)
        if not norm_q:
            return False
        # Always allow tools if any real-time, external, PC, file, math, or URL signal appears
        for sig in _FORCE_TOOL_SIGNALS:
            if sig in norm_q:
                return True
        # Check if query contains a math expression like "123 * 456"
        if re.search(r"\d+\s*[\+\-\*\/\^%]\s*\d+", norm_q):
            return True
        # Pure greetings / short social replies
        if len(norm_q) <= 20 and norm_q in {"hi", "hello", "chao", "xin chao", "ok", "oke", "cam on", "thanks", "tot", "hay"}:
            return False
        # Check if any domain hint matches
        q_tokens = _tokenize(norm_q)
        for item in self._indexed:
            for hint in item.hints:
                if " " in hint and hint in norm_q:
                    return True
                if " " not in hint and (hint in q_tokens or (len(hint) >= 5 and hint in norm_q)):
                    return True
        # Pure conversational / explanation / translation prompts with zero domain signals -> 0 tools
        if any(norm_q.startswith(p) or p in norm_q for p in _NO_TOOL_PREFIXES):
            return False
        # Default safe behavior: if zero domain signals matched at all, skip tools for pure chat
        return False

    def route(
        self,
        query: str,
        top_k: int = 6,
        pinned_names: Sequence[str] = (),
        allow_no_tool_fast_path: bool = True,
    ) -> list[types.FunctionDeclaration]:
        """Return up to top_k most relevant FunctionDeclarations (or [] on No-Tool Fast Path)."""
        if allow_no_tool_fast_path and top_k > 0 and not self.needs_tools(query):
            return []
        if top_k <= 0 or top_k >= len(self._all):
            return list(self._all)

        norm_q = normalize_text(query)
        q_tokens = _tokenize(norm_q)

        scored: list[tuple[float, _IndexedTool]] = []
        for item in self._indexed:
            score = 0.0

            # 1. Exact phrase / domain hint matches (strongest signal)
            for hint in item.hints:
                if " " in hint:
                    if hint in norm_q:
                        score += 5.0
                else:
                    if hint in q_tokens or (len(hint) >= 4 and hint in norm_q):
                        score += 3.5

            # 2. URL presence boosts web/pdf/network readers
            if "http://" in norm_q or "https://" in norm_q:
                if ".pdf" in norm_q and item.skill_prefix == "document_analyzer":
                    score += 8.0
                elif item.skill_prefix in ("web_reader", "network_inspector", "browser_reader"):
                    score += 3.0

            # 3. Direct overlap with tool name / description / parameter tokens
            overlap = q_tokens & item.meta_tokens
            for tok in overlap:
                if len(tok) >= 3:
                    score += 1.5

            scored.append((score, item))

        scored.sort(key=lambda pair: (pair[0], pair[1].name), reverse=True)

        selected: list[types.FunctionDeclaration] = []
        seen: set[str] = set()

        # Always keep previously used / pinned tools in multi-turn sessions first
        for pname in pinned_names:
            decl = self._by_name.get(pname)
            if decl and pname not in seen:
                selected.append(decl)
                seen.add(pname)

        # Add highest-scoring tools
        for score, item in scored:
            if len(selected) >= top_k:
                break
            if score > 0 and item.name not in seen:
                selected.append(item.declaration)
                seen.add(item.name)

        # Fill remaining slots with core fallback tools if we have room
        for fb_name in _ALWAYS_INCLUDE_FALLBACKS:
            if len(selected) >= top_k:
                break
            decl = self._by_name.get(fb_name)
            if decl and fb_name not in seen:
                selected.append(decl)
                seen.add(fb_name)

        # If query had zero matches, still fill up to top_k deterministically
        for _, item in scored:
            if len(selected) >= top_k:
                break
            if item.name not in seen:
                selected.append(item.declaration)
                seen.add(item.name)

        return selected
