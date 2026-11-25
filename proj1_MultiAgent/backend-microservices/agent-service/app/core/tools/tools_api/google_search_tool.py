import json
import os
import requests
from typing import Dict, Any
from app.core.tools.base_tool import BaseTool


class GoogleSearchTool(BaseTool):
    def __init__(self):
        self.name = "google_search_tool"
        self.description = "[Dùng API: GOOGLE_API_KEY, GOOGLE_CSE_ID] Tìm kiếm thông tin trực tiếp từ Google Custom Search JSON API."
        self.api_key = os.getenv("GOOGLE_API_KEY", "")
        self.cse_id = os.getenv("GOOGLE_CSE_ID", "")

    def execute(self, arguments: Dict[str, Any]) -> str:
        if isinstance(arguments, str):
            query = arguments
        elif isinstance(arguments, dict):
            query = (
                arguments.get("query")
                or arguments.get("input")
                or arguments.get("q")
                or arguments.get("keyword")
                or ""
            )
        else:
            query = str(arguments) if arguments else ""

        if not query or not str(query).strip():
            return json.dumps({"success": False, "error": "Từ khóa tìm kiếm không được để trống."}, ensure_ascii=False)

        api_key = (
            (arguments.get("api_key") if isinstance(arguments, dict) else None)
            or os.getenv("GOOGLE_API_KEY")
            or self.api_key
            or ""
        ).strip()
        cse_id = (
            (arguments.get("cse_id") if isinstance(arguments, dict) else None)
            or os.getenv("GOOGLE_CSE_ID")
            or self.cse_id
            or ""
        ).strip()

        if not api_key or not cse_id:
            return json.dumps({
                "success": False,
                "provider": "google_custom_search_api",
                "error": "Chưa cấu hình GOOGLE_API_KEY hoặc GOOGLE_CSE_ID trong biến môi trường hoặc vùng API Keys của Tool (google_search_tool)."
            }, ensure_ascii=False)

        try:
            url = "https://www.googleapis.com/customsearch/v1"
            params = {
                "key": api_key,
                "cx": cse_id,
                "q": query,
                "num": 5
            }

            response = requests.get(url, params=params, timeout=10)
            if response.status_code != 200:
                return json.dumps({
                    "success": False,
                    "provider": "google_custom_search_api",
                    "error": f"Lỗi Google Custom Search API ({response.status_code}): {response.text}"
                }, ensure_ascii=False)

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

            try:
                from app.core.tools.web_search import DuckDuckGoSearchTool
                if DuckDuckGoSearchTool._is_weather_query(query):
                    live_weather = DuckDuckGoSearchTool._fetch_live_weather(query)
                    if live_weather:
                        results.insert(0, live_weather)
            except Exception:
                pass

            return json.dumps({
                "success": True,
                "provider": "google_custom_search_api",
                "query": query,
                "results": results
            }, ensure_ascii=False)

        except Exception as e:
            return json.dumps({"success": False, "provider": "google_custom_search_api", "error": str(e)}, ensure_ascii=False)
