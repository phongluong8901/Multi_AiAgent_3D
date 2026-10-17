import json
import os
import requests
from typing import Dict, Any
from app.core.tools.base_tool import BaseTool

class WebSearchTool(BaseTool):
    def __init__(self):
        self.name = "web_search_tool"
        self.description = "Tìm kiếm thông tin, tin tức, dữ liệu mới nhất trên internet giống như Google Search."
        # Lấy API key từ biến môi trường của hệ thống
        self.api_key = os.getenv("TAVILY_API_KEY", "")

    def execute(self, arguments: Dict[str, Any]) -> str:
        query = arguments.get("query", "")
        if not query or not query.strip():
            return json.dumps({"success": False, "error": "Từ khóa tìm kiếm không được để trống."})

        if not self.api_key:
            return json.dumps({"success": False, "error": "Chưa cấu hình TAVILY_API_KEY trong biến môi trường."})

        try:
            # Gọi API Tavily Search
            response = requests.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": self.api_key,
                    "query": query,
                    "max_results": 5,
                    "include_answer": True  # Tự động tổng hợp câu trả lời ngắn gọn
                },
                timeout=10
            )
            
            if response.status_code != 200:
                return json.dumps({"success": False, "error": f"Lỗi API Search: {response.text}"})

            data = response.json()
            return json.dumps({
                "success": True,
                "query": query,
                "ai_answer": data.get("answer", ""),
                "results": [
                    {
                        "title": item.get("title"),
                        "url": item.get("url"),
                        "snippet": item.get("content")
                    }
                    for item in data.get("results", [])
                ]
            }, ensure_ascii=False)

        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})