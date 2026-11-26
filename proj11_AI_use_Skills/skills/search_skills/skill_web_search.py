"""Zero-key web and news search client using DDGS, DuckDuckGo HTML/Lite, and Google News RSS fallback."""
import re
import html
import urllib.parse
import xml.etree.ElementTree as ET
import httpx


class WebSearchClient:
    """Search the web and news without an API key."""

    def __init__(self, timeout: float = 15.0):
        self.timeout = timeout
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            )
        }

    def _clean_html(self, raw: str) -> str:
        text = re.sub(r"<[^>]+>", " ", raw or "")
        return re.sub(r"\s+", " ", html.unescape(text)).strip()

    def _extract_ddg_url(self, href: str) -> str:
        href = html.unescape(href)
        if "uddg=" in href:
            parsed = urllib.parse.urlparse(href)
            qs = urllib.parse.parse_qs(parsed.query)
            if "uddg" in qs and qs["uddg"]:
                return qs["uddg"][0]
        if href.startswith("//"):
            return "https:" + href
        return href

    def _search_ddg_html(self, query: str, max_results: int) -> list[dict]:
        r = httpx.get(
            "https://html.duckduckgo.com/html/",
            params={"q": query},
            headers=self.headers,
            timeout=self.timeout,
            follow_redirects=True,
        )
        if r.status_code != 200:
            raise RuntimeError(f"DuckDuckGo HTML HTTP {r.status_code}")

        body = r.text
        links = re.findall(
            r'<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
            body,
            re.DOTALL | re.IGNORECASE,
        )
        snippets = re.findall(
            r'<(?:a|div)[^>]*class="[^"]*result__snippet[^"]*"[^>]*>(.*?)</(?:a|div)>',
            body,
            re.DOTALL | re.IGNORECASE,
        )

        results = []
        for idx, (href, raw_title) in enumerate(links[:max_results]):
            title = self._clean_html(raw_title)
            clean_url = self._extract_ddg_url(href)
            snippet = self._clean_html(snippets[idx]) if idx < len(snippets) else ""
            if title and clean_url.startswith("http"):
                results.append(
                    {
                        "title": title,
                        "url": clean_url,
                        "snippet": snippet,
                        "source": "duckduckgo",
                        "readable": True,
                    }
                )
        return results

    def _search_ddgs_pkg(self, query: str, max_results: int) -> list[dict]:
        try:
            from ddgs import DDGS
        except ImportError:
            try:
                from duckduckgo_search import DDGS
            except ImportError:
                return []

        results = []
        with DDGS() as ddgs:
            for item in ddgs.text(query, max_results=max_results) or []:
                url = item.get("href") or item.get("url") or ""
                title = (item.get("title") or "").strip()
                snippet = (item.get("body") or item.get("snippet") or "").strip()
                if title and url.startswith("http"):
                    results.append(
                        {
                            "title": title,
                            "url": url,
                            "snippet": snippet,
                            "source": "ddgs",
                            "readable": True,
                        }
                    )
        return results

    def _search_google_news_rss(self, query: str, max_results: int, lang: str = "vi") -> list[dict]:
        hl = "vi" if lang == "vi" else "en-US"
        gl = "VN" if lang == "vi" else "US"
        ceid = "VN:vi" if lang == "vi" else "US:en"
        r = httpx.get(
            "https://news.google.com/rss/search",
            params={"q": query, "hl": hl, "gl": gl, "ceid": ceid},
            headers=self.headers,
            timeout=self.timeout,
            follow_redirects=True,
        )
        if r.status_code != 200:
            raise RuntimeError(f"Google News RSS HTTP {r.status_code}")

        root = ET.fromstring(r.text)
        results = []
        for item in root.findall(".//item")[:max_results]:
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub_date = (item.findtext("pubDate") or "").strip()
            desc = self._clean_html(item.findtext("description") or "")
            if title and link:
                results.append(
                    {
                        "title": title,
                        "url": link,
                        "snippet": f"{pub_date} - {desc}".strip(" -"),
                        "source": "google_news_rss",
                        "readable": False,
                    }
                )
        return results

    def search(self, query: str, max_results: int = 5, lang: str = "vi") -> list[dict]:
        """Return list of dicts: {title, url, snippet, source, readable}."""
        if not query or not query.strip():
            raise ValueError("Query khong duoc rong")
        errors = []

        # 1. Thu DDG HTML (tuong thich mock httpx.get trong pytest)
        try:
            res = self._search_ddg_html(query, max_results)
            if res:
                return res
        except Exception as e:
            errors.append(f"DDG_HTML: {e}")

        # 2. Thu goi ddgs (vuot chan IP datacenter tot hon)
        try:
            res = self._search_ddgs_pkg(query, max_results)
            if res:
                return res
        except Exception as e:
            errors.append(f"DDGS: {e}")

        # 3. Fallback cuoi cung: Google News RSS (chi dung title/snippet, khong nen scrape link RSS)
        try:
            res = self._search_google_news_rss(query, max_results, lang=lang)
            if res:
                return res
        except Exception as e:
            errors.append(f"RSS: {e}")

        if errors:
            raise RuntimeError(" | ".join(errors))
        raise RuntimeError(f"Khong tim thay ket qua nao cho: {query}")
