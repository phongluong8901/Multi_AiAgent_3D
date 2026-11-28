"""Cross-lingual search query decomposer and intent detector (Vietnamese & English)."""
import re
from typing import Any


class QueryDecomposer:
    """Analyze user questions and decompose them into focused search sub-queries."""

    VI_CHARS = re.compile(r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]", re.I)
    FRESH_HINTS = {
        "hôm nay", "mới nhất", "hiện tại", "gần đây", "bây giờ", "tuần này", "tháng này",
        "năm nay", "tin tức", "giá", "tỷ giá", "thời tiết", "2025", "2026",
        "today", "latest", "current", "recent", "now", "breaking", "news", "price", "weather",
    }
    INTENT_KEYWORDS = {
        "market": {"btc", "bitcoin", "eth", "crypto", "coin", "usdt", "binance", "giá vàng", "tỷ giá", "forex", "usd", "eur", "chứng khoán", "stock", "market"},
        "code": {"python", "javascript", "rust", "golang", "docker", "linux", "github", "api", "bug", "error", "traceback", "framework", "library", "pypi", "fastapi", "ollama", "code"},
        "paper": {"paper", "arxiv", "nghiên cứu", "bài báo khoa học", "benchmark", "architecture", "transformer", "rag", "llm", "thuật toán", "algorithm"},
        "video": {"youtube", "youtu.be", "video", "podcast", "tóm tắt video"},
        "news": {"tin tức", "tin mới", "sự kiện", "thời sự", "báo", "vnexpress", "breaking", "news", "headline"},
    }
    STOPWORDS = {
        "là", "gì", "của", "và", "các", "những", "cho", "tôi", "bạn", "hãy", "về", "trong",
        "có", "không", "như", "thế", "nào", "tại", "sao", "ở", "đâu", "khi", "một", "được",
        "the", "is", "are", "was", "were", "what", "how", "why", "who", "when", "where",
        "a", "an", "in", "on", "at", "for", "to", "of", "with", "about", "please", "tell", "me",
    }

    def decompose(self, question: str) -> dict[str, Any]:
        q = re.sub(r"\s+", " ", (question or "").strip())
        if not q:
            return {
                "original": "",
                "language": "en",
                "intent": "general",
                "freshness_needed": False,
                "keywords": [],
                "sub_queries": [],
            }

        ql = q.lower()
        language = "vi" if self.VI_CHARS.search(q) else "en"
        freshness_needed = any(h in ql for h in self.FRESH_HINTS)

        intent = "general"
        best_hits = 0
        for cand_intent, kws in self.INTENT_KEYWORDS.items():
            hits = sum(1 for kw in kws if kw in ql)
            if hits > best_hits:
                best_hits = hits
                intent = cand_intent

        tokens = re.findall(r"[\w\-\.]+", ql, flags=re.UNICODE)
        keywords = []
        seen = set()
        for t in tokens:
            if len(t) >= 2 and t not in self.STOPWORDS and t not in seen:
                seen.add(t)
                keywords.append(t)

        sub_queries = [q]
        # Tach cau hoi so sanh (X vs Y / so sanh X va Y)
        comp = re.search(r"(?:so sánh|compare)\s+(.+?)\s+(?:và|với|vs\.?|and)\s+(.+?)(?:\?|$)", q, flags=re.I)
        if not comp:
            comp = re.search(r"([\w\s\-\.]{2,40})\s+vs\.?\s+([\w\s\-\.]{2,40})", q, flags=re.I)
        if comp:
            left = comp.group(1).strip(" ?.,")
            right = comp.group(2).strip(" ?.,")
            if left and right:
                sub_queries.append(f"{left} {right} comparison benchmark")
                sub_queries.append(left)
                sub_queries.append(right)
        elif len(keywords) >= 4:
            sub_queries.append(" ".join(keywords[:6]))

        # Khu trung sub_queries giu thu tu
        deduped = []
        seen_q = set()
        for sq in sub_queries:
            key = sq.lower().strip()
            if key and key not in seen_q:
                seen_q.add(key)
                deduped.append(sq.strip())

        return {
            "original": q,
            "language": language,
            "intent": intent,
            "freshness_needed": freshness_needed,
            "keywords": keywords[:12],
            "sub_queries": deduped[:4],
        }
