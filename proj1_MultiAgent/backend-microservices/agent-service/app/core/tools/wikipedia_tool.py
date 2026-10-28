import json
import urllib.parse
import urllib.request
from typing import Dict, Any
from .base_tool import BaseTool


class WikipediaTool(BaseTool):
    name = "wikipedia_tool"
    description = (
        "Công cụ tra cứu Bách khoa toàn thư Wikipedia đa ngôn ngữ (Việt/Anh): "
        "trả về bản tóm tắt chuẩn xác, đường dẫn bài viết gốc và các khái niệm liên quan."
    )

    def _query_wiki(self, query: str, lang: str = "vi") -> Dict[str, Any]:
        encoded = urllib.parse.quote(query)
        search_url = (
            f"https://{lang}.wikipedia.org/w/api.php?"
            f"action=query&list=search&srsearch={encoded}&utf8=&format=json&srlimit=3"
        )
        req = urllib.request.Request(
            search_url, headers={"User-Agent": "MultiAgentSystem/2.0 (Educational)"}
        )
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            search_hits = data.get("query", {}).get("search", [])
            if not search_hits:
                return {}
            top_title = search_hits[0]["title"]

        summary_url = (
            f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/"
            f"{urllib.parse.quote(top_title.replace(' ', '_'))}"
        )
        req_sum = urllib.request.Request(
            summary_url, headers={"User-Agent": "MultiAgentSystem/2.0 (Educational)"}
        )
        with urllib.request.urlopen(req_sum, timeout=6) as resp_sum:
            sum_data = json.loads(resp_sum.read().decode("utf-8"))
            return {
                "title": sum_data.get("title", top_title),
                "description": sum_data.get("description", ""),
                "extract": sum_data.get("extract", ""),
                "url": sum_data.get("content_urls", {})
                .get("desktop", {})
                .get("page", f"https://{lang}.wikipedia.org/wiki/{urllib.parse.quote(top_title)}"),
                "language": lang,
            }

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            if isinstance(arguments, str):
                query = arguments
                lang = "vi"
            elif isinstance(arguments, dict):
                query = (
                    arguments.get("query")
                    or arguments.get("topic")
                    or arguments.get("input")
                    or ""
                )
                lang = str(arguments.get("lang") or "vi").lower()
            else:
                query = str(arguments or "")
                lang = "vi"

            query = query.strip()
            if not query:
                return json.dumps(
                    {"success": False, "error": "Chủ đề tra cứu Wikipedia không được để trống."},
                    ensure_ascii=False,
                )

            result = self._query_wiki(query, lang=lang)
            if not result and lang != "en":
                result = self._query_wiki(query, lang="en")

            if not result:
                return json.dumps(
                    {
                        "success": False,
                        "query": query,
                        "error": f"Không tìm thấy bài viết Wikipedia phù hợp cho '{query}'.",
                    },
                    ensure_ascii=False,
                )

            return json.dumps({"success": True, "query": query, **result}, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)
