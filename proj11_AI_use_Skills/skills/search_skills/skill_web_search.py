"""Zero-key resilient web search client using DDGS multi-backend (Bing/Yahoo/Auto), Bing HTML, Yahoo HTML, DDG, and Google News RSS."""
import base64
import html
import re
import urllib.parse
import xml.etree.ElementTree as ET

import httpx


class WebSearchClient:
    """Search the web without an API key using independent multi-engine fallbacks (immune to DuckDuckGo HTTP 202)."""

    def __init__(self, timeout: float = 15.0):
        self.timeout = timeout
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        }

    def _clean_html(self, raw: str) -> str:
        text = re.sub(r"<[^>]+>", " ", raw or "")
        return re.sub(r"\s+", " ", html.unescape(text)).strip()

    def _extract_ddg_url(self, href: str) -> str:
        href = html.unescape(href or "")
        if "uddg=" in href:
            parsed = urllib.parse.urlparse(href)
            qs = urllib.parse.parse_qs(parsed.query)
            if "uddg" in qs and qs["uddg"]:
                return qs["uddg"][0]
        if href.startswith("//"):
            return "https:" + href
        return href

    @staticmethod
    def _decode_bing_redirect(href: str) -> str:
        """Decode Bing /ck/a?u=a1<base64> redirect URLs into real destination URLs (e.g. https://shopee.vn/...)."""
        href = html.unescape(href or "")
        if "bing.com/ck/a" in href and "u=" in href:
            try:
                parsed = urllib.parse.urlparse(href)
                qs = urllib.parse.parse_qs(parsed.query)
                u_val = (qs.get("u") or [""])[0]
                if u_val.startswith("a1"):
                    b64 = u_val[2:]
                    b64 += "=" * (-len(b64) % 4)
                    decoded = base64.urlsafe_b64decode(b64.encode("ascii")).decode("utf-8", errors="ignore")
                    if decoded.startswith("http"):
                        return decoded
            except Exception:
                pass
        return href

    def _search_ddgs_pkg(self, query: str, max_results: int) -> list[dict]:
        """Try DDGS across non-DDG backends first (bing, yahoo, auto) to avoid DuckDuckGo HTTP 202."""
        try:
            from ddgs import DDGS
        except ImportError:
            try:
                from duckduckgo_search import DDGS
            except ImportError:
                return []

        last_err = None
        for backend in ("brave", "yahoo", "startpage", "auto"):
            try:
                results = []
                with DDGS() as ddgs:
                    try:
                        items = ddgs.text(query, max_results=max_results, backend=backend) or []
                    except TypeError:
                        items = ddgs.text(query, max_results=max_results) or []
                    for item in items:
                        url = item.get("href") or item.get("url") or ""
                        title = (item.get("title") or "").strip()
                        snippet = (item.get("body") or item.get("snippet") or "").strip()
                        if title and url.startswith("http"):
                            results.append(
                                {
                                    "title": title,
                                    "url": url,
                                    "snippet": snippet,
                                    "source": f"ddgs_{backend}",
                                    "readable": True,
                                }
                            )
                if results:
                    return results
            except Exception as exc:
                last_err = exc
                continue
        if last_err is not None:
            raise RuntimeError(f"DDGS multi-backend error: {last_err}")
        return []

    def _search_bing_html(self, query: str, max_results: int) -> list[dict]:
        """Direct Bing Web Search HTML parser (indexes Shopee VN, Lazada, Tiki, tech docs with real URLs)."""
        r = httpx.get(
            "https://www.bing.com/search",
            params={"q": query, "count": max(5, min(max_results + 3, 15)), "setlang": "vi"},
            headers=self.headers,
            timeout=self.timeout,
            follow_redirects=True,
        )
        if r.status_code != 200:
            raise RuntimeError(f"Bing HTML HTTP {r.status_code}")

        body = r.text
        blocks = re.findall(r'<li[^>]*class="[^"]*b_algo[^"]*"[^>]*>(.*?)</li>', body, re.DOTALL | re.IGNORECASE)
        results = []
        for blk in blocks:
            m_link = re.search(r"<h2[^>]*>.*?<a[^>]*href=\"([^\"]+)\"[^>]*>(.*?)</a>", blk, re.DOTALL | re.IGNORECASE)
            if not m_link:
                continue
            href = self._decode_bing_redirect(m_link.group(1))
            title = self._clean_html(m_link.group(2))
            m_snip = re.search(r'<p[^>]*>(.*?)</p>', blk, re.DOTALL | re.IGNORECASE)
            snippet = self._clean_html(m_snip.group(1)) if m_snip else ""
            if title and href.startswith("http"):
                results.append(
                    {
                        "title": title,
                        "url": href,
                        "snippet": snippet,
                        "source": "bing_html",
                        "readable": True,
                    }
                )
                if len(results) >= max_results:
                    break
        return results

    def _search_yahoo_html(self, query: str, max_results: int) -> list[dict]:
        """Direct Yahoo Web Search HTML fallback."""
        r = httpx.get(
            "https://search.yahoo.com/search",
            params={"p": query},
            headers=self.headers,
            timeout=self.timeout,
            follow_redirects=True,
        )
        if r.status_code != 200:
            raise RuntimeError(f"Yahoo HTML HTTP {r.status_code}")

        body = r.text
        links = re.findall(
            r'<a[^>]*class="[^"]*d-ib[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
            body,
            re.DOTALL | re.IGNORECASE,
        )
        results = []
        for href, raw_title in links:
            clean_url = html.unescape(href)
            if "/RU=" in clean_url:
                m_ru = re.search(r"/RU=([^/]+)/", clean_url)
                if m_ru:
                    clean_url = urllib.parse.unquote(m_ru.group(1))
            title = self._clean_html(raw_title)
            if title and clean_url.startswith("http") and "yahoo.com" not in clean_url:
                results.append(
                    {
                        "title": title,
                        "url": clean_url,
                        "snippet": "",
                        "source": "yahoo_html",
                        "readable": True,
                    }
                )
                if len(results) >= max_results:
                    break
        return results

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
                        "source": "duckduckgo_html",
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

    def _search_chrome_cdp(self, query: str, max_results: int) -> list[dict]:
        """Last-resort Web Search Defense: use real Chrome CDP (headless C:\\ChromeAgentProfile) to get live URLs."""
        from skills.automationPc_skills import skill_browser_cdp_controller as cdp

        q_low = (query or "").lower()
        site = "google"
        clean_q = query
        if "shopee" in q_low:
            site = "shopee"
            clean_q = re.sub(r"(?i)\b(?:site:shopee\.vn|shopee\.vn|shopee|sp|san pham|sản phẩm)\b", " ", query)
            clean_q = re.sub(r"\s+", " ", clean_q).strip() or query
        elif "lazada" in q_low:
            site = "lazada"
            clean_q = re.sub(r"(?i)\b(?:lazada\.vn|lazada)\b", " ", query).strip() or query
        elif "tiki" in q_low:
            site = "tiki"
            clean_q = re.sub(r"(?i)\b(?:tiki\.vn|tiki)\b", " ", query).strip() or query

        res = cdp.cdp_live_search(query=clean_q, site=site, limit=max_results)
        if res.get("ok") and res.get("results"):
            return res["results"][:max_results]
        if res.get("error"):
            raise RuntimeError(res["error"])
        return []

    def search(self, query: str, max_results: int = 5, lang: str = "vi") -> list[dict]:
        """Return list of dicts: {title, url, snippet, source, readable}."""
        if not query or not query.strip():
            raise ValueError("Query khong duoc rong")
        errors = []

        # 1. DDGS multi-backend (Brave / Yahoo / Startpage / Auto) — avoids DDG HTTP 202
        try:
            res = self._search_ddgs_pkg(query, max_results)
            if res:
                return res
        except Exception as e:
            errors.append(f"DDGS: {e}")

        # 2. Direct Bing Web Search HTML (great for Shopee VN, e-commerce, Vietnamese web)
        try:
            res = self._search_bing_html(query, max_results)
            if res:
                return res
        except Exception as e:
            errors.append(f"BING: {e}")

        # 3. Direct Yahoo Web Search HTML
        try:
            res = self._search_yahoo_html(query, max_results)
            if res:
                return res
        except Exception as e:
            errors.append(f"YAHOO: {e}")

        # 4. DuckDuckGo HTML fallback
        try:
            res = self._search_ddg_html(query, max_results)
            if res:
                return res
        except Exception as e:
            errors.append(f"DDG_HTML: {e}")

        # 5. Google News RSS (for news)
        try:
            res = self._search_google_news_rss(query, max_results, lang=lang)
            if res:
                return res
        except Exception as e:
            errors.append(f"RSS: {e}")

        # 6. LAST-RESORT DEFENSE: Real Chrome CDP Automation (live browser search)
        try:
            res = self._search_chrome_cdp(query, max_results)
            if res:
                return res
        except Exception as e:
            errors.append(f"CHROME_CDP: {e}")

        if errors:
            raise RuntimeError(" | ".join(errors))
        raise RuntimeError(f"Khong tim thay ket qua nao cho: {query}")
