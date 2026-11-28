"""Cross-lingual Hybrid Retriever combining Okapi BM25 + Ollama bge-m3 dense embeddings."""
import math
import re
from collections import Counter
from typing import Any
from urllib.parse import urlparse
import httpx


class HybridRetriever:
    """Fuse lexical BM25 and dense bge-m3 cosine similarity using Reciprocal Rank Fusion."""

    SKIP_URL_PATTERNS = (
        "/login", "/signin", "/signup", "/register", "/cart", "/checkout",
        "javascript:", "mailto:", "#", ".png", ".jpg", ".jpeg", ".gif", ".svg",
        ".css", ".js", ".ico", ".woff", ".zip", ".mp4", "facebook.com/sharer", "twitter.com/intent",
    )

    def __init__(
        self,
        embed_model: str = "bge-m3",
        ollama_base_url: str = "http://localhost:11434",
        timeout: float = 20.0,
        rrf_k: int = 60,
    ):
        self.embed_model = embed_model
        self.ollama_base_url = ollama_base_url.rstrip("/")
        self.timeout = timeout
        self.rrf_k = rrf_k

    @staticmethod
    def tokenize(text: str) -> list[str]:
        return re.findall(r"\w+", (text or "").lower(), flags=re.UNICODE)

    @staticmethod
    def cosine_similarity(a: list[float], b: list[float]) -> float:
        if not a or not b or len(a) != len(b):
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        na = math.sqrt(sum(x * x for x in a))
        nb = math.sqrt(sum(y * y for y in b))
        if na == 0.0 or nb == 0.0:
            return 0.0
        return dot / (na * nb)

    def bm25_scores(self, query: str, texts: list[str], k1: float = 1.5, b: float = 0.75) -> list[float]:
        if not texts:
            return []
        q_tokens = self.tokenize(query)
        if not q_tokens:
            return [0.0] * len(texts)

        doc_tokens = [self.tokenize(t) for t in texts]
        n_docs = len(doc_tokens)
        avgdl = sum(len(d) for d in doc_tokens) / max(1, n_docs)

        df: Counter[str] = Counter()
        tfs: list[Counter[str]] = []
        for dt in doc_tokens:
            c = Counter(dt)
            tfs.append(c)
            for term in c:
                df[term] += 1

        scores: list[float] = []
        for dt, tf in zip(doc_tokens, tfs):
            dl = len(dt)
            s = 0.0
            for qt in q_tokens:
                freq = tf.get(qt, 0)
                if freq == 0:
                    continue
                idf = math.log((n_docs - df[qt] + 0.5) / (df[qt] + 0.5) + 1.0)
                denom = freq + k1 * (1.0 - b + b * (dl / max(1.0, avgdl)))
                s += idf * (freq * (k1 + 1.0)) / max(1e-9, denom)
            scores.append(s)
        return scores

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        cleaned = [(t or " ")[:4000] for t in texts]
        # Uu tien /api/embed (batch nhanh), fallback sang /api/embeddings
        with httpx.Client(timeout=self.timeout) as client:
            try:
                r = client.post(
                    f"{self.ollama_base_url}/api/embed",
                    json={"model": self.embed_model, "input": cleaned},
                )
                if r.status_code == 200:
                    data = r.json()
                    embs = data.get("embeddings")
                    if isinstance(embs, list) and len(embs) == len(cleaned):
                        return embs
            except Exception:
                pass

            out: list[list[float]] = []
            for txt in cleaned:
                r = client.post(
                    f"{self.ollama_base_url}/api/embeddings",
                    json={"model": self.embed_model, "prompt": txt},
                )
                r.raise_for_status()
                out.append(r.json().get("embedding", []))
            return out

    def retrieve(
        self,
        query: str,
        documents: list[dict[str, Any]],
        top_k: int = 5,
        use_dense: bool = True,
        text_key: str = "text",
        precomputed_embeddings: list[list[float]] | None = None,
    ) -> list[dict[str, Any]]:
        if not documents:
            return []
        texts = [str(d.get(text_key, "")) for d in documents]
        bm25 = self.bm25_scores(query, texts)
        bm25_order = sorted(range(len(documents)), key=lambda i: bm25[i], reverse=True)
        bm25_rank = {idx: r + 1 for r, idx in enumerate(bm25_order)}

        dense_scores = [0.0] * len(documents)
        dense_rank: dict[int, int] = {}
        dense_ok = False

        if use_dense:
            try:
                q_emb = self.embed_texts([query])[0]
                if precomputed_embeddings and len(precomputed_embeddings) == len(documents):
                    d_embs = precomputed_embeddings
                else:
                    d_embs = self.embed_texts(texts)
                dense_scores = [self.cosine_similarity(q_emb, emb) for emb in d_embs]
                dense_order = sorted(range(len(documents)), key=lambda i: dense_scores[i], reverse=True)
                dense_rank = {idx: r + 1 for r, idx in enumerate(dense_order)}
                dense_ok = True
            except Exception:
                dense_ok = False

        scored: list[dict[str, Any]] = []
        for i, doc in enumerate(documents):
            if dense_ok:
                # RRF + small bonus for raw cosine so high semantic hits float up
                rrf = (1.0 / (self.rrf_k + bm25_rank[i])) + (1.25 / (self.rrf_k + dense_rank[i]))
                final_score = rrf + 0.02 * max(0.0, dense_scores[i])
            else:
                final_score = bm25[i]
            item = dict(doc)
            item["score"] = round(float(final_score), 6)
            item["bm25_score"] = round(float(bm25[i]), 4)
            item["dense_score"] = round(float(dense_scores[i]), 4)
            item["retrieval_mode"] = "hybrid_bge_bm25" if dense_ok else "bm25_only"
            scored.append(item)

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[: max(1, top_k)]

    def score_links_for_crawl(self, query: str, links: list[dict[str, Any]], top_n: int = 10) -> list[dict[str, Any]]:
        filtered = []
        seen = set()
        for lk in links:
            url = (lk.get("url") or "").strip()
            ul = url.lower()
            if not url.startswith(("http://", "https://")) or ul in seen:
                continue
            if any(pat in ul for pat in self.SKIP_URL_PATTERNS):
                continue
            seen.add(ul)
            anchor = str(lk.get("anchor") or lk.get("title") or "")
            path_text = urlparse(url).path.replace("/", " ").replace("-", " ").replace("_", " ")
            filtered.append({"url": url, "anchor": anchor, "text": f"{anchor} {path_text}".strip()})
        if not filtered:
            return []
        ranked = self.retrieve(query, filtered, top_k=top_n, use_dense=False)
        return ranked
