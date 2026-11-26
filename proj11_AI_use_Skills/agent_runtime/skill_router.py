"""Zero-Config Hybrid Skill Router (Auto-BM25 + SQLite Vector Embeddings + Adaptive Telemetry + Playbooks)."""
from __future__ import annotations

import hashlib
import math
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from typing import Any, Sequence

from google.genai import types

# Domain keyword expansion (normalized ASCII Vietnamese + English -> skill prefix)
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
        "thoi tiet", "nhiet do", "mua", "nang", "do am", "weather",
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
        "rss", "feed", "tin moi", "bai viet moi",
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
        "groq", "cloudflare", "gemini", "danh sach model", "list models", "check model",
        "kiem tra model", "9router", "provider", "api model",
    ),
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
        "trinh duyet", "playwright", "dynamic", "javascript", "spa", "css selector", "scrape", "render",
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

# Tier bonus applied ONLY when a skill has positive relevance to the query (Specialized First, Web Search Last)
_TIER_BONUS: dict[str, float] = {
    # Tier 1: Deterministic / Local / PC Automation (~0-50ms)
    "calculator": 2.4,
    "datetime_client": 2.4,
    "user_memory": 2.4,
    "local_workspace": 2.2,
    "report_exporter": 2.2,
    "document_analyzer": 2.2,
    "pc_safety_guard": 2.2,
    "smart_file_ops": 2.2,
    "clipboard_manager": 2.2,
    "office_com_excel": 2.0,
    "win_registry_startup": 2.2,
    "browser_cdp_controller": 2.0,
    # Tier 2: Fast Structured Domain APIs (~200-1200ms)
    "binance_crypto_client": 1.8,
    "frankfurter_forex_client": 1.8,
    "open_meteo_weather_client": 1.8,
    "openstreetmap_api_client": 1.6,
    "ip_geolocation_client": 1.6,
    "arxiv_api_client": 1.7,
    "pypi_api_client": 1.7,
    "github_api_client": 1.7,
    "huggingface_api_client": 1.6,
    "wikipedia_api_client": 1.5,
    "hacker_news_api_client": 1.5,
    "rss_feed_reader": 1.3,
    "provider_model_checker": 1.7,
    "network_inspector": 1.4,
    # Secondary structured weather tool ranked slightly below open_meteo, ready as backup!
    "weather_api_client": 0.9,
    # Tier 3: Heavy Web Search / Browser Scraping (Last resort)
    "web_reader": 0.4,
    "web_search": 0.2,
    "browser_reader": 0.0,
}

# Explicit Fail-to-Backup escalation chains: if key fails, unlock value(s) immediately in next step!
_FALLBACK_CHAINS: dict[str, tuple[str, ...]] = {
    "open_meteo_weather_client__get_current_weather": (
        "weather_api_client__get_current_weather",
        "web_search__search",
    ),
    "weather_api_client__get_current_weather": (
        "open_meteo_weather_client__get_current_weather",
        "web_search__search",
    ),
    "web_reader__read_url": (
        "browser_reader__read_dynamic_page",
        "web_search__search",
    ),
    "browser_reader__read_dynamic_page": (
        "web_reader__read_url",
        "web_search__search",
    ),
    "frankfurter_forex_client__get_exchange_rate": ("web_search__search",),
    "binance_crypto_client__get_crypto_price": ("web_search__search",),
    "arxiv_api_client__search_papers": ("web_search__search",),
    "github_api_client__search_repositories": ("web_search__search",),
    "pypi_api_client__get_package_info": ("web_search__search",),
    "wikipedia_api_client__get_summary": ("web_search__search",),
    "hacker_news_api_client__get_top_stories": ("rss_feed_reader__get_latest_articles", "web_search__search"),
    "rss_feed_reader__get_latest_articles": ("web_search__search",),
    "openstreetmap_api_client__get_coordinates": ("weather_api_client__get_latitude", "web_search__search"),
    "office_com_excel__execute": ("document_analyzer__analyze_tabular", "report_exporter__export_xlsx"),
    "local_workspace__list_files": ("smart_file_ops__execute",),
}

_ALWAYS_INCLUDE_FALLBACKS = (
    "web_search__search",
    "datetime_client__get_current_time",
    "calculator__evaluate",
)

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


def normalize_text(text: str) -> str:
    """Lowercase and strip Vietnamese diacritics for robust ASCII keyword matching."""
    text = (text or "").replace("đ", "d").replace("Đ", "D")
    nfkd = unicodedata.normalize("NFKD", text)
    ascii_str = "".join(ch for ch in nfkd if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", ascii_str.lower()).strip()


def _tokenize(normalized: str) -> set[str]:
    return set(re.findall(r"[a-z0-9_]+", normalized))


def compute_adaptive_telemetry_bonus(metric: dict[str, Any] | None) -> float:
    """Compute Bayesian-smoothed telemetry score so reliable fast tools lead, while failing tools step aside."""
    if not metric:
        # Optimistic neutral prior (~0.75 * 1.2 = +0.9) so unexplored tools are never starved
        return 0.9

    calls = int(metric.get("calls") or 0)
    succ = int(metric.get("successes") or 0)
    avg_ms = float(metric.get("avg_ms") or 500.0)
    consec_fail = int(metric.get("consecutive_failures") or 0)

    # Laplace/Bayesian smoothed reliability in [0.0, 1.0]
    reliability = (succ + 3.0) / (calls + 4.0)
    bonus = reliability * 1.2

    # Speed bonus
    if avg_ms <= 400:
        bonus += 0.5
    elif avg_ms <= 1500:
        bonus += 0.25

    # Consecutive failure penalty lets lower-rated backup tools automatically overtake a broken primary tool!
    if consec_fail > 0:
        bonus -= 1.4 * min(consec_fail, 3)

    return round(bonus, 3)


_STOP_WORDS = frozenset(
    {
        "the", "and", "for", "with", "from", "that", "this", "into", "using", "return", "dict",
        "str", "int", "float", "bool", "list", "true", "false", "default", "execute", "action",
        "skill", "client", "api", "get", "set", "run", "data", "info", "none", "optional",
        "cua", "cho", "voi", "cac", "nhung", "mot", "trong", "khi", "nao", "nhu", "the", "la",
        "ban", "toi", "minh", "giup", "hay", "xem", "nay", "kia", "day", "roi", "nhe", "nha",
    }
)


def _cosine_similarity(v1: Sequence[float], v2: Sequence[float]) -> float:
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    n1 = math.sqrt(sum(a * a for a in v1))
    n2 = math.sqrt(sum(b * b for b in v2))
    if n1 == 0.0 or n2 == 0.0:
        return 0.0
    return dot / (n1 * n2)


def _collect_schema_terms(schema: types.Schema | None) -> list[str]:
    """Recursively extract parameter names, descriptions, and enum actions for zero-config indexing."""
    if schema is None:
        return []
    terms: list[str] = []
    if schema.description:
        terms.append(schema.description)
    if schema.enum:
        terms.extend(str(e).replace("_", " ") for e in schema.enum)
    for k, v in (schema.properties or {}).items():
        terms.append(str(k).replace("_", " "))
        terms.extend(_collect_schema_terms(v))
    if schema.items:
        terms.extend(_collect_schema_terms(schema.items))
    return terms


@dataclass(frozen=True)
class _IndexedTool:
    declaration: types.FunctionDeclaration
    name: str
    skill_prefix: str
    doc_text: str
    doc_hash: str
    tf: Counter[str]
    doc_len: int
    meta_tokens: frozenset[str]
    hints: tuple[str, ...]
    tier_bonus: float


class SkillRouter:
    """Zero-Config Hybrid Router: Auto-BM25 + SQLite Embeddings + Specialized Tiers + Adaptive Telemetry."""

    def __init__(self, declarations: Sequence[types.FunctionDeclaration]):
        self._all: list[types.FunctionDeclaration] = list(declarations)
        self._by_name: dict[str, types.FunctionDeclaration] = {
            d.name: d for d in self._all if d.name
        }
        self._indexed: list[_IndexedTool] = []
        self._idf: dict[str, float] = {}
        self._avg_doc_len: float = 1.0
        self._embeddings: dict[str, list[float]] = {}
        self._embed_client: Any = None
        self._embed_model: str = "gemini-embedding-001"

        df: Counter[str] = Counter()
        total_len = 0

        for decl in self._all:
            name = decl.name or ""
            skill_prefix = name.split("__", 1)[0]
            schema_terms = " ".join(_collect_schema_terms(decl.parameters))
            # Repeat name tokens twice so exact tool/method names carry strong BM25 weight
            name_clean = name.replace("__", " ").replace("_", " ")
            raw_doc = f"{name_clean} {name_clean} {decl.description or ''} {schema_terms}"
            norm_doc = normalize_text(raw_doc)
            raw_tokens = [t for t in re.findall(r"[a-z0-9]+", norm_doc) if len(t) >= 2 and t not in _STOP_WORDS]
            tf = Counter(raw_tokens)
            for tok in tf:
                df[tok] += 1
            total_len += len(raw_tokens)

            doc_hash = hashlib.sha256(norm_doc.encode("utf-8")).hexdigest()[:16]
            hints = _DOMAIN_HINTS.get(skill_prefix, ())
            t_bonus = _TIER_BONUS.get(skill_prefix, 1.4)
            self._indexed.append(
                _IndexedTool(
                    declaration=decl,
                    name=name,
                    skill_prefix=skill_prefix,
                    doc_text=norm_doc[:600],
                    doc_hash=doc_hash,
                    tf=tf,
                    doc_len=max(1, len(raw_tokens)),
                    meta_tokens=frozenset(tf.keys()),
                    hints=hints,
                    tier_bonus=t_bonus,
                )
            )

        n_docs = max(1, len(self._indexed))
        self._avg_doc_len = max(1.0, total_len / n_docs)
        for tok, freq in df.items():
            self._idf[tok] = math.log(1.0 + (n_docs - freq + 0.5) / (freq + 0.5))

    def sync_embeddings(self, client: Any, memory_store: Any, model: str = "gemini-embedding-001") -> int:
        """Lazily embed only new/changed tools and persist vectors in SQLite (0 API calls when cached)."""
        if client is None or memory_store is None:
            return 0
        self._embed_client = client
        self._embed_model = model
        cached = memory_store.get_tool_embeddings_map()
        missing: list[_IndexedTool] = []

        for item in self._indexed:
            entry = cached.get(item.name)
            if entry and entry[0] == item.doc_hash and entry[1]:
                self._embeddings[item.name] = entry[1]
            else:
                missing.append(item)

        if not missing:
            return len(self._embeddings)

        # Embed missing tools in a single batch call (or small chunks)
        try:
            for i in range(0, len(missing), 32):
                batch = missing[i : i + 32]
                resp = client.models.embed_content(
                    model=model,
                    contents=[it.doc_text for it in batch],
                )
                vecs = getattr(resp, "embeddings", None) or []
                for it, emb in zip(batch, vecs):
                    vals = list(getattr(emb, "values", None) or [])
                    if vals:
                        self._embeddings[it.name] = vals
                        memory_store.upsert_tool_embedding(it.name, it.doc_hash, vals, model)
        except Exception:
            # Fail silently to pure BM25 + Hints if offline or rate-limited
            pass
        return len(self._embeddings)

    def _bm25_score(self, q_tokens: list[str], item: _IndexedTool, k1: float = 1.5, b: float = 0.75) -> float:
        score = 0.0
        for tok in q_tokens:
            tf = item.tf.get(tok, 0)
            if tf <= 0:
                continue
            idf = self._idf.get(tok, 0.5)
            denom = tf + k1 * (1.0 - b + b * (item.doc_len / self._avg_doc_len))
            score += idf * ((tf * (k1 + 1.0)) / denom)
        return score

    def _query_embedding(self, norm_q: str) -> list[float] | None:
        if not self._embeddings or self._embed_client is None:
            return None
        try:
            resp = self._embed_client.models.embed_content(
                model=self._embed_model,
                contents=norm_q,
            )
            vecs = getattr(resp, "embeddings", None) or []
            if vecs:
                return list(getattr(vecs[0], "values", None) or [])
        except Exception:
            pass
        return None

    @property
    def total_tools(self) -> int:
        return len(self._all)

    def extract_significant_keywords(self, query: str) -> list[str]:
        norm_q = normalize_text(query)
        q_tokens = _tokenize(norm_q)
        matched: list[str] = []
        for hints in _DOMAIN_HINTS.values():
            for h in hints:
                if (" " in h and h in norm_q) or (" " not in h and h in q_tokens):
                    if h not in matched:
                        matched.append(h)
        return matched[:8]

    def match_playbook(
        self,
        query: str,
        playbooks: Sequence[dict[str, Any]],
    ) -> tuple[list[str], str]:
        """Find the best matching experiential playbook (if >= 2 trigger keywords match)."""
        norm_q = normalize_text(query)
        q_tokens = _tokenize(norm_q)
        best_score = 0
        best_tools: list[str] = []
        best_hint = ""

        for pb in playbooks or []:
            kws = [k.strip().lower() for k in str(pb.get("trigger_keywords", "")).split(",") if k.strip()]
            hits = 0
            for kw in kws:
                if " " in kw and kw in norm_q:
                    hits += 2
                elif kw in q_tokens or (len(kw) >= 4 and kw in norm_q):
                    hits += 1
            if hits >= 2:
                weighted = hits * 10 + min(int(pb.get("success_count") or 1), 10)
                if weighted > best_score:
                    best_score = weighted
                    best_tools = [
                        t.strip()
                        for t in str(pb.get("tools_csv", "")).split(",")
                        if t.strip() in self._by_name
                    ]
                    best_hint = str(pb.get("strategy_hint") or "")

        return best_tools, best_hint

    def get_backup_declarations(
        self,
        failed_tool_names: Sequence[str],
        current_decls: Sequence[types.FunctionDeclaration],
    ) -> list[types.FunctionDeclaration]:
        """Return backup/lower-rated tools to unlock immediately when a primary tool fails."""
        existing = {d.name for d in current_decls if d.name}
        failed_set = set(failed_tool_names)
        unlocked: list[types.FunctionDeclaration] = []

        for fname in failed_tool_names:
            # 1. Explicit fallback chain
            for cand_name in _FALLBACK_CHAINS.get(fname, ()):
                decl = self._by_name.get(cand_name)
                if decl and cand_name not in existing and cand_name not in failed_set:
                    unlocked.append(decl)
                    existing.add(cand_name)

            # 2. Same-domain alternative tools (e.g. another weather / file / search skill)
            failed_prefix = fname.split("__", 1)[0]
            failed_hints = set(_DOMAIN_HINTS.get(failed_prefix, ()))
            if failed_hints:
                for item in self._indexed:
                    if item.name in existing or item.name in failed_set:
                        continue
                    if len(failed_hints & set(item.hints)) >= 2:
                        unlocked.append(item.declaration)
                        existing.add(item.name)

        # 3. Universal safety-net fallback for custom/auto skills without an explicit chain
        if not unlocked:
            for cand_name in ("web_search__search", "web_reader__read_url"):
                decl = self._by_name.get(cand_name)
                if decl and cand_name not in existing and cand_name not in failed_set:
                    unlocked.append(decl)
                    existing.add(cand_name)
                    break

        return unlocked[:3]

    def needs_tools(self, query: str) -> bool:
        """Fast-path intent gate: return False for pure chat/writing/concept prompts to save ~90% tokens."""
        norm_q = normalize_text(query)
        if not norm_q:
            return False
        for sig in _FORCE_TOOL_SIGNALS:
            if sig in norm_q:
                return True
        if re.search(r"\d+\s*[\+\-\*\/\^%]\s*\d+", norm_q):
            return True
        if len(norm_q) <= 20 and norm_q in {
            "hi", "hello", "chao", "xin chao", "ok", "oke", "cam on", "thanks", "tot", "hay",
        }:
            return False
        q_tokens = _tokenize(norm_q)
        for item in self._indexed:
            for hint in item.hints:
                if " " in hint and hint in norm_q:
                    return True
                if " " not in hint and (hint in q_tokens or (len(hint) >= 5 and hint in norm_q)):
                    return True
        if any(norm_q.startswith(p) or p in norm_q for p in _NO_TOOL_PREFIXES):
            return False
        # Zero-config check: if query strongly matches ANY auto-indexed BM25 tool (>= 2.8), allow tools!
        q_list = [t for t in re.findall(r"[a-z0-9]+", norm_q) if len(t) >= 3 and t not in _STOP_WORDS]
        if q_list:
            for item in self._indexed:
                if self._bm25_score(q_list, item) >= 2.8:
                    return True
        return False

    def route(
        self,
        query: str,
        top_k: int = 6,
        pinned_names: Sequence[str] = (),
        metrics_map: dict[str, dict[str, Any]] | None = None,
        playbook_tools: Sequence[str] = (),
        allow_no_tool_fast_path: bool = True,
        use_embeddings: bool = False,
    ) -> list[types.FunctionDeclaration]:
        """Select top_k tools via Zero-Config BM25 + Optional Embeddings + Tier + Adaptive Telemetry."""
        if allow_no_tool_fast_path and top_k > 0 and not playbook_tools and not self.needs_tools(query):
            return []
        if top_k <= 0 or top_k >= len(self._all):
            return list(self._all)

        norm_q = normalize_text(query)
        q_tokens = _tokenize(norm_q)
        q_list = [t for t in re.findall(r"[a-z0-9]+", norm_q) if len(t) >= 2 and t not in _STOP_WORDS]
        m_map = metrics_map or {}
        q_vec = self._query_embedding(norm_q) if use_embeddings else None

        scored: list[tuple[float, _IndexedTool]] = []
        for item in self._indexed:
            relevance = 0.0

            # 1. Zero-config BM25 score (works automatically for ALL 82+ tools with zero manual hints!)
            bm25 = self._bm25_score(q_list, item)
            relevance += bm25 * 1.8

            # 2. Optional SQLite-cached Semantic Embedding similarity
            if q_vec is not None and item.name in self._embeddings:
                sim = _cosine_similarity(q_vec, self._embeddings[item.name])
                if sim > 0.45:
                    relevance += (sim - 0.45) * 14.0

            # 3. Domain phrase hints (bonus for Vietnamese colloquial phrases)
            for hint in item.hints:
                if " " in hint:
                    if hint in norm_q:
                        relevance += 4.5
                else:
                    if hint in q_tokens or (len(hint) >= 4 and hint in norm_q):
                        relevance += 2.8

            if "http://" in norm_q or "https://" in norm_q:
                if ".pdf" in norm_q and item.skill_prefix == "document_analyzer":
                    relevance += 8.0
                elif item.skill_prefix in ("web_reader", "network_inspector", "browser_reader"):
                    relevance += 3.0

            adaptive = compute_adaptive_telemetry_bonus(m_map.get(item.name))
            if relevance > 0.5:
                total_score = relevance + item.tier_bonus + adaptive
            else:
                total_score = adaptive * 0.1

            scored.append((total_score, item))

        scored.sort(key=lambda pair: (pair[0], pair[1].name), reverse=True)

        selected: list[types.FunctionDeclaration] = []
        seen: set[str] = set()

        # 1. Playbook tools (proven multi-tool combo for this query pattern)
        for pb_tool in playbook_tools:
            decl = self._by_name.get(pb_tool)
            if decl and pb_tool not in seen and len(selected) < top_k:
                selected.append(decl)
                seen.add(pb_tool)

        # 2. Pinned tools from earlier turns in the session (cap to 2 so they don't crowd out new tools)
        for pname in list(pinned_names)[-2:]:
            decl = self._by_name.get(pname)
            if decl and pname not in seen and len(selected) < top_k:
                selected.append(decl)
                seen.add(pname)

        # 3. Highest-scoring relevant tools (Specialized Tier + Adaptive Telemetry)
        for score, item in scored:
            if len(selected) >= top_k:
                break
            if score >= 1.0 and item.name not in seen:
                selected.append(item.declaration)
                seen.add(item.name)

        # 4. Essential safety-net fallbacks
        for fb_name in _ALWAYS_INCLUDE_FALLBACKS:
            if len(selected) >= top_k:
                break
            decl = self._by_name.get(fb_name)
            if decl and fb_name not in seen:
                selected.append(decl)
                seen.add(fb_name)

        # 5. Deterministic fill if still below top_k
        for _, item in scored:
            if len(selected) >= top_k:
                break
            if item.name not in seen:
                selected.append(item.declaration)
                seen.add(item.name)

        return selected
