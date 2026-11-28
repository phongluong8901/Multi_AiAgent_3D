"""Zero-key webpage reader that fetches a URL and extracts clean readable text."""
import re
from html.parser import HTMLParser
import httpx


class _CleanTextExtractor(HTMLParser):
    SKIP_TAGS = {"script", "style", "noscript", "svg", "nav", "footer", "header", "iframe", "aside"}

    def __init__(self):
        super().__init__()
        self._skip_depth = 0
        self._in_title = False
        self.title_parts: list[str] = []
        self.text_parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in self.SKIP_TAGS:
            self._skip_depth += 1
        elif tag == "title":
            self._in_title = True

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in self.SKIP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1
        elif tag == "title":
            self._in_title = False
        elif tag in {"p", "div", "li", "h1", "h2", "h3", "h4", "br", "tr"} and self._skip_depth == 0:
            self.text_parts.append("\n")

    def handle_data(self, data):
        if self._in_title:
            self.title_parts.append(data)
        if self._skip_depth == 0:
            cleaned = data.strip()
            if cleaned:
                self.text_parts.append(cleaned + " ")


class WebReaderClient:
    """Fetch any webpage and extract clean title and body text."""

    def __init__(self, timeout: float = 15.0):
        self.timeout = timeout
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            )
        }

    def read_url(self, url: str, max_chars: int = 4000) -> dict:
        """Return dict keys: url, final_url, title, text, status_code."""
        if not url or not url.startswith(("http://", "https://")):
            raise ValueError(f"URL khong hop le: {url}")

        r = httpx.get(
            url,
            headers=self.headers,
            timeout=self.timeout,
            follow_redirects=True,
        )
        if r.status_code != 200:
            raise RuntimeError(f"HTTP {r.status_code} khi tai {url}: {r.text[:200]}")

        parser = _CleanTextExtractor()
        parser.feed(r.text)
        title = re.sub(r"\s+", " ", "".join(parser.title_parts)).strip()
        raw_text = "".join(parser.text_parts)
        clean_text = re.sub(r"[ \t]+", " ", raw_text)
        clean_text = re.sub(r"\n{3,}", "\n\n", clean_text).strip()

        if not clean_text:
            raise RuntimeError(f"Khong trich xuat duoc noi dung van ban tu {url}")

        return {
            "url": url,
            "final_url": str(r.url),
            "title": title,
            "text": clean_text[:max_chars],
            "status_code": r.status_code,
        }
