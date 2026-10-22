from typing import Dict, Any
from .base_tool import BaseTool
import requests
from bs4 import BeautifulSoup
import json
import re
from urllib.parse import urljoin, quote_plus

class WebCrawlerTool(BaseTool):
    name = "web_crawler_tool"
    description = "Công cụ crawl và bóc tách nội dung chi tiết bài viết báo chí hoặc trang danh mục thông minh (hỗ trợ CafeF, Znews, v.v.)."

    def _clean_text(self, text: str) -> str:
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def _crawl_and_parse(self, url: str) -> dict:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
        try:
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code != 200:
                return {"error": f"Failed to fetch URL. Status code: {response.status_code}"}
            
            soup = BeautifulSoup(response.content, 'lxml')
            
            # Lưu lại tiêu đề trang chính xác
            title = soup.title.string if soup.title else ""
            title = self._clean_text(title)
            
            # Bóc tách Sapo của bài viết
            sapo_el = soup.find(class_=re.compile(r'(sapo|summary|shortdesc)', re.I)) or soup.find('h2', class_=re.compile(r'(sapo|summary|shortdesc)', re.I))
            sapo = self._clean_text(sapo_el.get_text()) if sapo_el else ""
            
            # Loại bỏ các thành phần rác
            for element in soup(["script", "style", "iframe", "header", "footer", "nav", "noscript", "form"]):
                element.decompose()
                
            # Tìm khối chứa nội dung chính
            content_div = None
            for class_pattern in [r'detail-content', r'totalcontent', r'news-content', r'contentdetail', r'post-body']:
                content_div = soup.find(class_=re.compile(class_pattern, re.I))
                if content_div:
                    break
                    
            if not content_div:
                content_div = soup.body
                
            paragraphs = []
            if content_div:
                for p in content_div.find_all(['p', 'h2', 'h3']):
                    if p.find('a') and len(p.get_text()) < 55:
                        continue
                    text = self._clean_text(p.get_text())
                    if len(text) > 35 and text not in paragraphs:
                        if any(ban in text for ban in ["Kênh bản tin", "Bản tin Video", "Mời độc giả", "Xem thêm"]):
                            continue
                        paragraphs.append(text)
            
            # Nếu số lượng đoạn văn nhỏ -> Đây có thể là trang chủ / hub / danh mục
            if len(paragraphs) < 3:
                links = []
                for a in soup.find_all('a', href=True):
                    href = urljoin(url, a['href'])
                    text = self._clean_text(a.get_text())
                    if len(text) > 25 and href != url:
                        links.append({"title": text, "url": href})
                return {
                    "type": "hub_or_homepage",
                    "title": title,
                    "featured_links": links[:15]
                }
                
            return {
                "type": "article",
                "source_url": url,
                "title": title,
                "sapo": sapo,
                "structured_paragraphs": paragraphs
            }
            
        except Exception as e:
            return {"error": str(e)}

    def execute(self, arguments: Dict[str, Any]) -> str:
        if isinstance(arguments, str):
            url = arguments
        elif isinstance(arguments, dict):
            url = arguments.get("url") or arguments.get("input") or arguments.get("link") or ""
        else:
            url = str(arguments) if arguments else ""

        if not url:
            return json.dumps({"success": False, "error": "Missing 'url' parameter for crawler."})
        
        result = self._crawl_and_parse(url)
        return json.dumps({"success": True, "data": result}, ensure_ascii=False)

# {
#   "tool_id": "sentiment_analysis",
#   "arguments": {
#     "text": "I am so excited and happy to build this amazing AI system!"
#   }
# }