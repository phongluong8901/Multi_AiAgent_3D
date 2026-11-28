"""Multi-engine Meta-Search with Reciprocal Rank Fusion (RRF) and URL canonicalization."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.parse import parse_qs, quote_plus, unquote, urlencode, urlparse, urlunparse
import xml.etree.ElementTree as ET
import httpx
from bs4 import BeautifulSoup


class MetaSearchRRF:
    """Query multiple live search engines concurrently and fuse rankings with RRF."""

    TRACKING_PARAMS = {"utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "ref"}
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    }

    def __init__(self, k: int = 60, timeout: float = 12.0):
        self.k = k
        self.timeout = timeout

    @classmethod
    def canonicalize_url(cls, url: str) -> str:
        try:
            p = urlparse((url or "").strip())
            if p.scheme not in ("http", "https") or not p.netloc:
                return ""
            qs = parse_qs(p.query, keep_blank_values=False)
            clean_qs = {k: v for k, v in qs.items() if k.lower() not in cls.TRACKING_PARAMS}
            new_query = urlencode(sorted(clean_qs.items()), doseq=True)
            path = p.path.rstrip("/") or "/"
            return urlunparse((p.scheme.lower(), p.netloc.lower(), path, "", new_query, ""))
        except Exception:
            return ""

    def fuse_rankings(self, provider_results: dict[str, list[dict[str, Any]]], top_k: int = 15) -> list[dict[str, Any]]:
        merged: dict[str, dict[str, Any]] = {}
        for provider, items in (provider_results or {}).items():
            seen_in_provider = set()
            rank = 0
            for it in items or []:
                canon = self.canonicalize_url(str(it.get("url", "")))
                if not canon or canon in seen_in_provider:
                    continue
                seen_in_provider.add(canon)
                rank += 1
                rrf_add = 1.0 / (self.k + rank)
                if canon not in merged:
                    merged[canon] = {
                        "url": canon,
                        "title": str(it.get("title") or "").strip(),
                        "snippet": str(it.get("snippet") or "").strip(),
                        "published": str(it.get("published") or "").strip(),
                        "providers": [provider],
                        "rrf_score": rrf_add,
                    }
                else:
                    merged[canon]["rrf_score"] += rrf_add
                    if provider not in merged[canon]["providers"]:
                        merged[canon]["providers"].append(provider)
                    if len(str(it.get("snippet") or "")) > len(merged[canon]["snippet"]):
                        merged[canon]["snippet"] = str(it.get("snippet") or "").strip()
                    if not merged[canon]["title"] and it.get("title"):
                        merged[canon]["title"] = str(it.get("title")).strip()

        ranked = sorted(merged.values(), key=lambda x: x["rrf_score"], reverse=True)
        for item in ranked:
            item["rrf_score"] = round(item["rrf_score"], 6)
        return ranked[: max(1, top_k)]

    def parse_google_news_rss(self, xml_text: str) -> list[dict[str, Any]]:
        out = []
        root = ET.fromstring(xml_text)
        for item in root.findall(".//item")[:10]:
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub = (item.findtext("pubDate") or "").strip()
            if title and link:
                out.append({"title": title, "url": link, "snippet": title, "published": pub})
        return out

    def parse_reddit_json(self, data: dict[str, Any]) -> list[dict[str, Any]]:
        out = []
        for child in ((data or {}).get("data") or {}).get("children") or []:
            d = child.get("data") or {}
            title = (d.get("title") or "").strip()
            permalink = d.get("permalink") or ""
            url = f"https://www.reddit.com{permalink}" if permalink else (d.get("url") or "")
            snippet = (d.get("selftext") or title)[:280].strip()
            if title and url:
                out.append({"title": title, "url": url, "snippet": snippet, "published": ""})
        return out

    def _search_ddg(self, query: str) -> list[dict[str, Any]]:
        out = []
        with httpx.Client(headers=self.HEADERS, follow_redirects=True, timeout=self.timeout) as client:
            r = client.post("https://html.duckduckgo.com/html/", data={"q": query})
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "lxml")
            for res in soup.select(".result")[:10]:
                a = res.select_one("a.result__a")
                snip = res.select_one(".result__snippet")
                if not a:
                    continue
                href = a.get("href", "")
                if "uddg=" in href:
                    qs = parse_qs(urlparse(href).query)
                    href = unquote(qs.get("uddg", [href])[0])
                if href.startswith(("http://", "https://")):
                    out.append({"title": a.get_text(" ", strip=True), "url": href, "snippet": snip.get_text(" ", strip=True) if snip else ""})
        return out

    def _search_google_news(self, query: str, lang: str = "vi") -> list[dict[str, Any]]:
        params = "hl=vi&gl=VN&ceid=VN:vi" if lang == "vi" else "hl=en-US&gl=US&ceid=US:en"
        url = f"https://news.google.com/rss/search?q={quote_plus(query)}&{params}"
        with httpx.Client(headers=self.HEADERS, follow_redirects=True, timeout=self.timeout) as client:
            r = client.get(url)
            r.raise_for_status()
            return self.parse_google_news_rss(r.text)

    def _search_hn_algolia(self, query: str) -> list[dict[str, Any]]:
        url = f"https://hn.algolia.com/api/v1/search?query={quote_plus(query)}&hitsPerPage=8"
        with httpx.Client(headers=self.HEADERS, timeout=self.timeout) as client:
            r = client.get(url)
            r.raise_for_status()
            out = []
            for h in r.json().get("hits", []):
                u = h.get("url") or f"https://news.ycombinator.com/item?id={h.get('objectID')}"
                t = h.get("title") or h.get("story_title") or ""
                if t and u:
                    out.append({"title": t, "url": u, "snippet": f"HN points={h.get('points', 0)}, comments={h.get('num_comments', 0)}", "published": h.get("created_at", "")})
            return out

    def _search_wikipedia(self, query: str, lang: str = "vi") -> list[dict[str, Any]]:
        url = f"https://{lang}.wikipedia.org/w/api.php?action=opensearch&search={quote_plus(query)}&limit=5&namespace=0&format=json"
        with httpx.Client(headers=self.HEADERS, timeout=self.timeout) as client:
            r = client.get(url)
            r.raise_for_status()
            arr = r.json()
            if len(arr) < 4:
                return []
            return [{"title": t, "url": u, "snippet": d} for t, d, u in zip(arr[1], arr[2], arr[3]) if u]

    def _search_arxiv(self, query: str) -> list[dict[str, Any]]:
        url = f"https://export.arxiv.org/api/query?search_query=all:{quote_plus(query)}&start=0&max_results=5"
        with httpx.Client(headers=self.HEADERS, timeout=self.timeout) as client:
            r = client.get(url)
            r.raise_for_status()
            ns = {"a": "http://www.w3.org/2005/Atom"}
            root = ET.fromstring(r.text)
            out = []
            for e in root.findall("a:entry", ns):
                t = (e.findtext("a:title", default="", namespaces=ns) or "").replace("\n", " ").strip()
                u = (e.findtext("a:id", default="", namespaces=ns) or "").strip()
                s = (e.findtext("a:summary", default="", namespaces=ns) or "").replace("\n", " ").strip()[:260]
                p = (e.findtext("a:published", default="", namespaces=ns) or "").strip()
                if t and u:
                    out.append({"title": t, "url": u, "snippet": s, "published": p})
            return out

    def _search_reddit(self, query: str) -> list[dict[str, Any]]:
        url = f"https://www.reddit.com/search.json?q={quote_plus(query)}&limit=6"
        headers = {"User-Agent": "AutoEvolveResearchBot/1.0"}
        with httpx.Client(headers=headers, timeout=self.timeout) as client:
            r = client.get(url)
            r.raise_for_status()
            return self.parse_reddit_json(r.json())

    def search_all(self, query: str, top_k: int = 12, lang: str = "vi", intent: str = "general") -> list[dict[str, Any]]:
        tasks = {
            "duckduckgo": lambda: self._search_ddg(query),
            "google_news": lambda: self._search_google_news(query, lang=lang),
            "wikipedia": lambda: self._search_wikipedia(query, lang=lang),
            "reddit": lambda: self._search_reddit(query),
        }
        if intent in ("code", "paper", "general"):
            tasks["hacker_news"] = lambda: self._search_hn_algolia(query)
        if intent in ("paper", "code"):
            tasks["arxiv"] = lambda: self._search_arxiv(query)

        provider_results: dict[str, list[dict[str, Any]]] = {}
        with ThreadPoolExecutor(max_workers=len(tasks)) as pool:
            futs = {pool.submit(fn): name for name, fn in tasks.items()}
            for fut in as_completed(futs):
                name = futs[fut]
                try:
                    res = fut.result()
                    if res:
                        provider_results[name] = res
                except Exception:
                    pass
        return self.fuse_rankings(provider_results, top_k=top_k)
