import re
from typing import List, Dict, Any
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

TOOL_SCHEMA = {
    "name": "skill_web_link_seo_auditor",
    "description": "Kiểm tra liên kết hỏng broken link 404 trên trang web, phân tích SEO thẻ title meta description OpenGraph heading H1 H2. Audit an HTML document for SEO metadata (title, meta description, canonical, OpenGraph, H1-H3 counts, missing image alt tags) and optionally check link HTTP statuses via a mockable HEAD helper.",
    "risk_level": "safe",
    "parameters": {
        "action": "audit_html_seo, extract_all_links, check_links_status",
        "html": "HTML document as a string",
        "base_url": "Base URL for relative links",
        "urls": "List of URLs to check",
        "timeout": "Timeout for link checks",
        "max_links": "Maximum number of links to check"
    }
}

def execute(action: str = "audit_html_seo", **kwargs) -> Dict[str, Any]:
    try:
        if action == "audit_html_seo":
            return audit_html_seo(kwargs.get("html", ""), kwargs.get("base_url", ""))
        elif action == "extract_all_links":
            return extract_all_links(kwargs.get("html", ""), kwargs.get("base_url", ""))
        elif action == "check_links_status":
            return check_links_status(kwargs.get("urls", []), kwargs.get("timeout", 5.0), kwargs.get("max_links", 20))
        else:
            return {"ok": False, "error": "Unknown action"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def audit_html_seo(html: str, base_url: str = '') -> Dict[str, Any]:
    soup = BeautifulSoup(html, 'html.parser')
    
    title = soup.title.string if soup.title else None
    meta_description = soup.find('meta', attrs={'name': 'description'})
    meta_description = meta_description['content'] if meta_description else None
    canonical = soup.find('link', rel='canonical')
    canonical = canonical['href'] if canonical else None
    og_tags = {tag['property']: tag['content'] for tag in soup.find_all('meta', property=True)}
    h1_count = len(soup.find_all('h1'))
    h2_count = len(soup.find_all('h2'))
    h3_count = len(soup.find_all('h3'))
    missing_alt_tags = [img for img in soup.find_all('img') if not img.get('alt')]

    return {
        "ok": True,
        "data": {
            "title": title,
            "meta_description": meta_description,
            "canonical": canonical,
            "og_tags": og_tags,
            "h1_count": h1_count,
            "h2_count": h2_count,
            "h3_count": h3_count,
            "missing_alt_tags": [img['src'] for img in missing_alt_tags]
        }
    }

def extract_all_links(html: str, base_url: str = '') -> Dict[str, Any]:
    soup = BeautifulSoup(html, 'html.parser')
    links = [a['href'] for a in soup.find_all('a', href=True)]
    absolute_links = [urljoin(base_url, link) for link in links]
    return {"ok": True, "data": absolute_links}

def _fetch_raw(url: str, timeout: float = 5.0) -> int:
    try:
        import requests
    except ImportError:
        return {"ok": False, "error": "Missing package requests"}
    
    try:
        response = requests.head(url, timeout=timeout)
        return response.status_code
    except requests.RequestException:
        return 404

def check_links_status(urls: List[str], timeout: float = 5.0, max_links: int = 20) -> Dict[str, Any]:
    results = {}
    for url in urls[:max_links]:
        status_code = _fetch_raw(url, timeout)
        results[url] = status_code
    return {"ok": True, "data": results}
