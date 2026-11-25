import json
import os
import requests
from typing import Dict, Any
from app.core.tools.base_tool import BaseTool


class TavilyWebSearchTool(BaseTool):
    def __init__(self):
        self.name = "web_search_tool"
        self.description = "[Dùng API: TAVILY_API_KEY] Công cụ tìm kiếm thông tin và tổng hợp AI từ Tavily Search API."
        self.api_key = os.getenv("TAVILY_API_KEY", "")

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
            or os.getenv("TAVILY_API_KEY")
            or self.api_key
            or ""
        ).strip()

        if not api_key:
            return json.dumps({
                "success": False,
                "provider": "tavily_api",
                "error": "Chưa cấu hình TAVILY_API_KEY trong biến môi trường hoặc vùng API Keys của Tool (web_search_tool)."
            }, ensure_ascii=False)

        try:
            response = requests.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": api_key,
                    "query": query,
                    "max_results": 5,
                    "include_answer": True
                },
                timeout=10
            )

            if response.status_code != 200:
                return json.dumps({
                    "success": False,
                    "provider": "tavily_api",
                    "error": f"Lỗi Tavily Search API ({response.status_code}): {response.text}"
                }, ensure_ascii=False)

            data = response.json()
            results = []
            for item in (data.get("results") or [])[:4]:
                raw_snip = str(item.get("content") or "")
                clean_snip = " ".join(raw_snip.split())[:450]
                results.append(
                    {
                        "title": item.get("title"),
                        "url": item.get("url"),
                        "snippet": clean_snip,
                    }
                )
            ai_answer = str(data.get("answer") or "").strip()

            # Nếu là câu hỏi thời tiết, bổ sung thêm số liệu trạm khí tượng trực tiếp (Open-Meteo) lên đầu kết quả
            try:
                from app.core.tools.web_search import DuckDuckGoSearchTool
                if DuckDuckGoSearchTool._is_weather_query(query):
                    live_weather = DuckDuckGoSearchTool._fetch_live_weather(query)
                    if live_weather:
                        results.insert(0, live_weather)
                        ai_answer = live_weather["snippet"]
            except Exception:
                pass

            return json.dumps({
                "success": True,
                "provider": "tavily_api",
                "query": query,
                "ai_answer": ai_answer,
                "results": results
            }, ensure_ascii=False)

        except Exception as e:
            return json.dumps({"success": False, "provider": "tavily_api", "error": str(e)}, ensure_ascii=False)


WebSearchTool = TavilyWebSearchTool
