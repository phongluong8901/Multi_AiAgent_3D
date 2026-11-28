"""Universal Media-to-Markdown Ingestor: HTML (trafilatura), YouTube, PDF/Office (markitdown), OCR (qwen2.5vl)."""
import base64
import os
import re
from typing import Any
from urllib.parse import parse_qs, urlparse
import httpx
from bs4 import BeautifulSoup


class UniversalIngestor:
    """Convert diverse web and file sources into clean Markdown text."""

    OFFICE_EXTS = {".docx", ".xlsx", ".pptx", ".csv", ".epub", ".txt", ".md"}
    IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}

    def __init__(self, ollama_chat_url: str = "http://localhost:11434/api/chat", timeout: float = 60.0):
        self.ollama_chat_url = ollama_chat_url
        self.timeout = timeout

    @staticmethod
    def extract_youtube_id(url_or_id: str) -> str | None:
        s = (url_or_id or "").strip()
        if re.fullmatch(r"[A-Za-z0-9_-]{11}", s):
            return s
        p = urlparse(s)
        host = p.netloc.lower()
        if "youtu.be" in host:
            vid = p.path.strip("/").split("/")[0]
            return vid if re.fullmatch(r"[A-Za-z0-9_-]{11}", vid) else None
        if "youtube.com" in host:
            qs = parse_qs(p.query)
            if "v" in qs and qs["v"]:
                return qs["v"][0]
            m = re.search(r"/(?:shorts|embed|live)/([A-Za-z0-9_-]{11})", p.path)
            if m:
                return m.group(1)
        return None

    def detect_source_type(self, source: str, content_type: str = "") -> str:
        s = (source or "").strip()
        sl = s.lower()
        ct = (content_type or "").lower()
        if "youtube.com" in sl or "youtu.be" in sl:
            return "youtube"
        if "application/pdf" in ct or sl.endswith(".pdf"):
            return "pdf"
        if ct.startswith("image/") or any(sl.endswith(ext) for ext in self.IMAGE_EXTS):
            return "image"
        if any(sl.endswith(ext) for ext in self.OFFICE_EXTS):
            return "office"
        if s.startswith(("http://", "https://")) or "text/html" in ct:
            return "html"
        return "text"

    def ingest_html(self, html: str, url: str = "") -> dict[str, Any]:
        raw = (html or "").strip()
        if not raw:
            return {"title": "", "markdown": "", "url": url, "extractor": "empty"}

        soup = BeautifulSoup(raw, "lxml")
        title = soup.title.get_text(" ", strip=True) if soup.title else ""

        md_text = ""
        extractor = "bs4"
        try:
            import trafilatura  # type: ignore
            extracted = trafilatura.extract(
                raw,
                url=url or None,
                output_format="markdown",
                include_tables=True,
                include_links=False,
                favor_precision=False,
            )
            if extracted and len(extracted.strip()) >= 80:
                md_text = extracted.strip()
                extractor = "trafilatura"
        except Exception:
            pass

        if not md_text:
            for tag in soup(["script", "style", "noscript", "nav", "footer", "header", "aside"]):
                tag.decompose()
            lines = [ln.strip() for ln in soup.get_text("\n").splitlines() if len(ln.strip()) > 1]
            md_text = "\n".join(lines)

        return {"title": title, "markdown": md_text, "url": url, "extractor": extractor}

    def ingest_youtube(self, url_or_id: str, languages: list[str] | None = None) -> dict[str, Any]:
        vid = self.extract_youtube_id(url_or_id)
        if not vid:
            raise ValueError(f"Invalid YouTube URL or ID: {url_or_id}")
        langs = languages or ["vi", "en"]
        from youtube_transcript_api import YouTubeTranscriptApi  # type: ignore

        entries = None
        if hasattr(YouTubeTranscriptApi, "get_transcript"):
            entries = YouTubeTranscriptApi.get_transcript(vid, languages=langs)
        else:
            api = YouTubeTranscriptApi()
            entries = api.fetch(vid, languages=langs)

        texts = []
        for item in entries:
            txt = item.get("text", "") if isinstance(item, dict) else getattr(item, "text", "")
            if txt:
                texts.append(txt.strip())

        return {
            "video_id": vid,
            "url": f"https://www.youtube.com/watch?v={vid}",
            "title": f"YouTube Video {vid}",
            "markdown": " ".join(texts),
            "extractor": "youtube_transcript_api",
        }

    def ingest_file(self, file_path: str) -> dict[str, Any]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        ext = os.path.splitext(file_path)[1].lower()

        if ext in (".txt", ".md", ".csv", ".json"):
            content = open(file_path, "r", encoding="utf-8", errors="ignore").read()
            return {"title": os.path.basename(file_path), "markdown": content, "extractor": "plain_text"}

        try:
            from markitdown import MarkItDown  # type: ignore
            res = MarkItDown().convert(file_path)
            if res and getattr(res, "text_content", ""):
                return {"title": os.path.basename(file_path), "markdown": res.text_content.strip(), "extractor": "markitdown"}
        except Exception:
            pass

        if ext == ".pdf":
            from pypdf import PdfReader  # type: ignore
            reader = PdfReader(file_path)
            text = "\n\n".join((p.extract_text() or "").strip() for p in reader.pages).strip()
            return {"title": os.path.basename(file_path), "markdown": text, "extractor": "pypdf"}

        raise ValueError(f"Unsupported file format: {ext}")

    def ocr_image_ollama(self, image_bytes: bytes, model: str = "qwen2.5vl:7b", prompt: str = "Extract all text, tables, and chart numbers in clean Markdown.") -> str:
        if not image_bytes:
            return ""
        b64 = base64.b64encode(image_bytes).decode("ascii")
        payload = {
            "model": model,
            "stream": False,
            "messages": [{"role": "user", "content": prompt, "images": [b64]}],
        }
        with httpx.Client(timeout=self.timeout) as client:
            r = client.post(self.ollama_chat_url, json=payload)
            r.raise_for_status()
            return (r.json().get("message", {}).get("content") or "").strip()
