import json
import urllib.parse
import urllib.request
from typing import Dict, Any, List
from .base_tool import BaseTool


class WebSearchTool(BaseTool):
    name = "web_search_tool"
    description = (
        "Công cụ tìm kiếm thông tin trên mạng Internet (DuckDuckGo Search + Instant Answer + Wikipedia fallback)."
    )

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            if isinstance(arguments, str):
                query = arguments
            elif isinstance(arguments, dict):
                query = (
                    arguments.get("query")
                    or arguments.get("q")
                    or arguments.get("input")
                    or ""
                )
            else:
                query = str(arguments or "")

            query = query.strip()
            if not query:
                return json.dumps(
                    {"success": False, "error": "Từ khóa tìm kiếm không được để trống."},
                    ensure_ascii=False,
                )

            results: List[Dict[str, str]] = []

            # 1. Thử dùng thư viện duckduckgo_search (DDGS) nếu có
            try:
                from duckduckgo_search import DDGS

                with DDGS() as ddgs:
                    for r in ddgs.text(query, max_results=5):
                        results.append(
                            {
                                "title": r.get("title", ""),
                                "snippet": r.get("body", ""),
                                "url": r.get("href", ""),
                            }
                        )
            except Exception:
                pass

            # 2. Fallback gọi DuckDuckGo Instant Answer API
            if not results:
                try:
                    encoded = urllib.parse.quote(query)
                    url = f"https://api.duckduckgo.com/?q={encoded}&format=json&no_html=1&skip_disambig=1"
                    req = urllib.request.Request(
                        url, headers={"User-Agent": "MultiAgentSystem/2.0"}
                    )
                    with urllib.request.urlopen(req, timeout=6) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                        if data.get("AbstractText"):
                            results.append(
                                {
                                    "title": data.get("Heading") or query,
                                    "snippet": data.get("AbstractText"),
                                    "url": data.get("AbstractURL") or "https://duckduckgo.com",
                                }
                            )
                        for topic in (data.get("RelatedTopics") or [])[:4]:
                            if isinstance(topic, dict) and topic.get("Text"):
                                results.append(
                                    {
                                        "title": topic.get("Text", "")[:80],
                                        "snippet": topic.get("Text", ""),
                                        "url": topic.get("FirstURL", ""),
                                    }
                                )
                except Exception:
                    pass

            return json.dumps(
                {
                    "success": True,
                    "query": query,
                    "total_results": len(results),
                    "results": results,
                },
                ensure_ascii=False,
            )
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)
