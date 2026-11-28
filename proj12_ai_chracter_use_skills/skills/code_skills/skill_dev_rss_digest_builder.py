import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Dict

TOOL_SCHEMA = {
    "name": "skill_dev_rss_digest_builder",
    "description": "Tạo tool gom tin tức RSS Atom thời tiết giá cả thành bản tin tóm tắt hằng ngày Markdown HTML, phân tích XML feed không cần thư viện ngoài. Create a tool to aggregate RSS and Atom XML feeds into daily digest reports in Markdown or HTML, parsing XML feeds without external libraries.",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["parse_rss_atom_xml", "render_daily_digest", "generate_digest_app"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: List[str], cwd: str = None) -> str:
    import subprocess
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def _http_get(url: str, timeout: float = 3.0) -> str:
    import urllib.request
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return response.read()

def parse_rss_atom_xml(xml_text: str, max_items: int = 10) -> List[Dict]:
    root = ET.fromstring(xml_text)
    namespace = {'atom': 'http://www.w3.org/2005/Atom'}
    items = []

    if root.tag.endswith('rss'):
        for item in root.findall('.//item')[:max_items]:
            title = item.find('title').text if item.find('title') is not None else ''
            link = item.find('link').text if item.find('link') is not None else ''
            description = item.find('description').text if item.find('description') is not None else ''
            items.append({'title': title, 'link': link, 'description': description})
    elif root.tag.endswith('feed'):
        for entry in root.findall('.//atom:entry', namespace)[:max_items]:
            title = entry.find('atom:title', namespace).text if entry.find('atom:title', namespace) is not None else ''
            link = entry.find('atom:link', namespace).attrib.get('href', '') if entry.find('atom:link', namespace) is not None else ''
            summary = entry.find('atom:summary', namespace).text if entry.find('atom:summary', namespace) is not None else ''
            items.append({'title': title, 'link': link, 'description': summary})

    return items

def render_daily_digest(title: str, sections: List[Dict], fmt: str = 'markdown') -> str:
    if fmt == 'markdown':
        report = f"# {title}\n\n"
        for section in sections:
            report += f"## {section['title']}\n"
            for item in section['items']:
                report += f"- [{item['title']}]({item['link']})\n  {item['description']}\n"
    elif fmt == 'html':
        report = f"<h1>{title}</h1>\n"
        for section in sections:
            report += f"<h2>{section['title']}</h2>\n<ul>\n"
            for item in section['items']:
                report += f"<li><a href='{item['link']}'>{item['title']}</a><br/>{item['description']}</li>\n"
            report += "</ul>\n"
    else:
        raise ValueError("Unsupported format. Use 'markdown' or 'html'.")
    return report

def generate_digest_app(feeds: List[str], output_dir: str = '.', dry_run: bool = True) -> None:
    output_path = Path(output_dir) / 'daily_digest.md'
    sections = []

    for feed in feeds:
        items = parse_rss_atom_xml(feed, max_items=10)
        sections.append({'title': 'Feed', 'items': items})

    digest = render_daily_digest(title="Daily Digest", sections=sections, fmt='markdown')

    if not dry_run:
        output_path.write_text(digest)
    else:
        print(f"Dry run: {digest}")

def execute(action: str, **kwargs) -> Dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}

    if action == "parse_rss_atom_xml":
        xml_text = kwargs.get('xml_text', '')
        max_items = kwargs.get('max_items', 10)
        return {"ok": True, "result": parse_rss_atom_xml(xml_text, max_items)}

    if action == "render_daily_digest":
        title = kwargs.get('title', '')
        sections = kwargs.get('sections', [])
        fmt = kwargs.get('fmt', 'markdown')
        return {"ok": True, "result": render_daily_digest(title, sections, fmt)}

    if action == "generate_digest_app":
        feeds = kwargs.get('feeds', [])
        output_dir = kwargs.get('output_dir', '.')
        dry_run = kwargs.get('dry_run', True)
        generate_digest_app(feeds, output_dir, dry_run)
        return {"ok": True, "result": "Digest app generated"}

    return {"ok": False, "error": "Invalid action parameters"}
