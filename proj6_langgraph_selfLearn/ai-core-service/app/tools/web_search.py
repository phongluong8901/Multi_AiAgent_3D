"""
External Web Search Tool Integration.
Provides real-time web search capabilities powered by Tavily Search API
for acquiring current information and verifying factual hypotheses.
"""

import httpx
from typing import Optional
from ..core.config import settings

async def search_the_web(query: str, max_results: int = 4) -> str:
    """
    Executes an asynchronous HTTP REST query against Tavily Search API.
    Parses summarized responses and source citations into formatted markdown text.

    Args:
        query: Search keywords or question.
        max_results: Maximum number of search result items to return.

    Returns:
        Formatted summary and list of search results with sources.
    """
    api_key = settings.TAVILY_API_KEY
    if not api_key or api_key.strip() in ("", "your_tavily_api_key_here"):
        return "[Lỗi Web Search]: TAVILY_API_KEY chưa được thiết lập trong file .env."

    url = "https://api.tavily.com/search"
    payload = {
        "api_key": api_key.strip(),
        "query": query,
        "max_results": max_results,
        "search_depth": "basic",
        "include_answer": True
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code != 200:
                return f"[Lỗi Tavily HTTP {response.status_code}]: {response.text}"

            data = response.json()
            results = data.get("results", [])
            if not results:
                answer = data.get("answer")
                return answer if answer else "Không tìm thấy kết quả phù hợp trên Internet."

            formatted = []
            if data.get("answer"):
                formatted.append(f"Tóm tắt: {data['answer']}\n")

            for item in results:
                title = item.get("title", "")
                link = item.get("url", "")
                content = item.get("content", "")
                formatted.append(f"- [{title}]({link}): {content}")

            return "\n".join(formatted)

    except httpx.TimeoutException:
        return "[Lỗi Tavily]: Quá thời gian chờ phản hồi từ máy chủ Tavily (Timeout)."
    except Exception as e:
        return f"[Lỗi Tavily]: {str(e)}"
