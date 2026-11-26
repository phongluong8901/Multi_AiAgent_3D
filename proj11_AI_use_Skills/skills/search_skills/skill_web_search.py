"""Zero-key web and news search client using DuckDuckGo HTML, DDGS package, and Google News RSS fallback."""
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
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
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
        
        # Mau regex linh hoat hon cho cac cau truc HTML khac nhau cua DuckDuckGo Lite/HTML
        links = re.findall(
            r'<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
            body,
            re.DOTALL | re.IGNORECASE,
        )
        if not links:
            # Fallback thu mau link tong quat hon trong ket qua tim kiem HTML
            links = re.findall(
                r'<a[^>]*class="[^"]*result__url[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
                body,
                re.DOTALL | re.IGNORECASE,
            )

        snippets = re.findall(
            r'<(?:a|div|td)[^>]*class="[^"]*result__snippet[^"]*"[^>]*>(.*?)</(?:a|div|td)>',
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
            from duckduckgo_search import DDGS
        except ImportError:
            try:
                from ddgs import DDGS
            except ImportError:
                return []

        results = []
        try:
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
        except Exception:
            pass
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
        """Search the web or news using query string and return list of result dicts."""
        if not query or not query.strip():
            raise ValueError("Query khong duoc rong")
        
        errors = []

        # 1. Thu goi ddgs package truoc neu co san de tranh bi chan HTML IP datacenter
        try:
            res = self._search_ddgs_pkg(query, max_results)
            if res:
                return res
        except Exception as e:
            errors.append(f"DDGS: {e}")

        # 2. Thu DDG HTML
        try:
            res = self._search_ddg_html(query, max_results)
            if res:
                return res
        except Exception as e:
            errors.append(f"DDG_HTML: {e}")

        # 3. Fallback cuoi cung: Google News RSS
        try:
            res = self._search_google_news_rss(query, max_results, lang=lang)
            if res:
                return res
        except Exception as e:
            errors.append(f"RSS: {e}")

        if errors:
            raise RuntimeError(" | ".join(errors))
        raise RuntimeError(f"Khong tim thay ket qua nao cho: {query}")
