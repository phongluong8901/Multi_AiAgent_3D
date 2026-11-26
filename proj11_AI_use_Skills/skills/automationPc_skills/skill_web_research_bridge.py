import xml.etree.ElementTree as ET
from urllib.request import urlopen
from html.parser import HTMLParser
import re

TOOL_SCHEMA = {
    "name": "skill_web_research_bridge",
    "description": "Lightweight web search & page text extraction bridge for Windows agent: parse Google News RSS XML, extract clean readable text from HTML, and fetch web pages via urllib/httpx helper.",
    "risk_level": "safe",
    "parameters": {
        "search_news_rss": {
            "query": "str",
            "lang": "str",
            "limit": "int"
        },
        "extract_clean_text": {
            "html": "str",
            "max_chars": "int"
        },
        "fetch_page_summary": {
            "url": "str",
            "max_chars": "int"
        }
    }
}

class MLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.reset()
        self.strict = False
        self.convert_charrefs = True
        self.text = []

    def handle_data(self, d):
        self.text.append(d)

    def get_data(self):
        return ' '.join(self.text)

def _fetch_raw(url):
    try:
        with urlopen(url) as response:
            return response.read().decode('utf-8')  # Decode bytes to str
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _parse_rss(rss_content, limit):
    try:
        root = ET.fromstring(rss_content)
        items = root.findall('.//item')[:limit]
        return [{"title": item.find('title').text, "link": item.find('link').text} for item in items]
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _extract_text(html_content):
    try:
        s = MLStripper()
        s.feed(html_content)
        return s.get_data()
    except Exception as e:
        return {"ok": False, "error": str(e)}

def search_news_rss(query: str, lang: str='vi', limit: int=8):
    url = f"https://news.google.com/rss/search?q={query}&hl={lang}&gl=VN&ceid=VN:{lang}"
    rss_content = _fetch_raw(url)
    if isinstance(rss_content, dict) and not rss_content["ok"]:
        return rss_content
    return _parse_rss(rss_content, limit)

def extract_clean_text(html: str, max_chars: int=4000):
    text = _extract_text(html)
    if isinstance(text, dict) and not text["ok"]:
        return text
    return text[:max_chars]

def fetch_page_summary(url: str, max_chars: int=3000):
    html_content = _fetch_raw(url)
    if isinstance(html_content, dict) and not html_content["ok"]:
        return html_content
    clean_text = _extract_text(html_content)
    if isinstance(clean_text, dict) and not clean_text["ok"]:
        return clean_text
    return clean_text[:max_chars]

def execute(action: str = "search_news_rss", **kwargs) -> dict:
    try:
        if action == "search_news_rss":
            return search_news_rss(**kwargs)
        elif action == "extract_clean_text":
            return extract_clean_text(**kwargs)
        elif action == "fetch_page_summary":
            return fetch_page_summary(**kwargs)
        else:
            return {"ok": False, "error": "Unknown action"}
    except Exception as e:
        return {"ok": False, "error": str(e)}
