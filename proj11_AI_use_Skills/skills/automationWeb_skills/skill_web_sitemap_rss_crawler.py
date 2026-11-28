import xml.etree.ElementTree as ET
from typing import List, Dict

TOOL_SCHEMA = {
    "name": "skill_web_sitemap_rss_crawler",
    "description": "Parse robots.txt rules, XML sitemaps (<urlset>/<sitemapindex>), and RSS/Atom feeds using xml.etree.ElementTree, filtering discovered URLs or articles by keyword and limit.",
    "risk_level": "safe",
    "parameters": {
        "action": "parse_robots_txt, parse_sitemap_xml, parse_rss_atom",
        "content": "str",
        "user_agent": "str",
        "xml_text": "str",
        "keyword": "str",
        "limit": "int"
    }
}

def execute(action: str = "parse_robots_txt", **kwargs) -> Dict[str, any]:
    try:
        if action == "parse_robots_txt":
            return parse_robots_txt(kwargs.get("content", ""), kwargs.get("user_agent", "*"))
        elif action == "parse_sitemap_xml":
            return parse_sitemap_xml(kwargs.get("xml_text", ""), kwargs.get("keyword", ""), kwargs.get("limit", 50))
        elif action == "parse_rss_atom":
            return parse_rss_atom(kwargs.get("xml_text", ""), kwargs.get("keyword", ""), kwargs.get("limit", 20))
        else:
            return {"ok": False, "error": "Unknown action"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def parse_robots_txt(content: str, user_agent: str = '*') -> Dict[str, any]:
    rules = {}
    lines = content.splitlines()
    for line in lines:
        line = line.strip()
        if line.startswith(f"User-agent: {user_agent}"):
            rules = {}
        elif line.startswith("Disallow:"):
            rules[line[9:].strip()] = False
        elif line.startswith("Allow:"):
            rules[line[6:].strip()] = True
    return {"ok": True, "rules": rules}

def parse_sitemap_xml(xml_text: str, keyword: str = '', limit: int = 50) -> Dict[str, any]:
    try:
        root = ET.fromstring(xml_text)
        urls = []
        for url in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}url"):
            loc = url.find("{http://www.sitemaps.org/schemas/sitemap/0.9}loc").text
            if keyword in loc:
                urls.append(loc)
            if len(urls) >= limit:
                break
        return {"ok": True, "urls": urls}
    except ET.ParseError as e:
        return {"ok": False, "error": str(e)}

def parse_rss_atom(xml_text: str, keyword: str = '', limit: int = 20) -> Dict[str, any]:
    try:
        root = ET.fromstring(xml_text)
        articles = []
        for entry in root.findall(".//{http://www.w3.org/2005/Atom}entry"):
            title = entry.find("{http://www.w3.org/2005/Atom}title").text
            if keyword in title:
                articles.append(title)
            if len(articles) >= limit:
                break
        return {"ok": True, "articles": articles}
    except ET.ParseError as e:
        return {"ok": False, "error": str(e)}
