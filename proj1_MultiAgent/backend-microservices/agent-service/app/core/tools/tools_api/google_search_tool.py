import json
import os
import requests
from typing import Dict, Any
from app.core.tools.base_tool import BaseTool

class GoogleSearchTool(BaseTool):
    def __init__(self):
        self.name = "google_search_tool"
        self.description = "Tìm kiếm thông tin, tin tức mới nhất trực tiếp từ Google Custom Search API."
        self.api_key = os.getenv("GOOGLE_API_KEY", "")
        self.cse_id = os.getenv("GOOGLE_CSE_ID", "")

    def execute(self, arguments: Dict[str, Any]) -> str:
        query = arguments.get("query", "")
        if not query or not query.strip():
            return json.dumps({"success": False, "error": "Từ khóa tìm kiếm không được để trống."})

        if not self.api_key or not self.cse_id:
            return json.dumps({"success": False, "error": "Chưa cấu hình GOOGLE_API_KEY hoặc GOOGLE_CSE_ID trong biến môi trường."})

        try:
            url = "https://www.googleapis.com/customsearch/v1"
            params = {
                "key": self.api_key,
                "cx": self.cse_id,
                "q": query,
                "num": 5  # Lấy tối đa 5 kết quả đầu tiên
            }
            
            response = requests.get(url, params=params, timeout=10)
            if response.status_code != 200:
                return json.dumps({"success": False, "error": f"Lỗi Google API: {response.text}"})

            data = response.json()
            items = data.get("items", [])
            
            results = [
                {
                    "title": item.get("title"),
                    "url": item.get("link"),
                    "snippet": item.get("snippet")
                }
                for item in items
            ]

            return json.dumps({
                "success": True,
                "query": query,
                "results": results
            }, ensure_ascii=False)

        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})