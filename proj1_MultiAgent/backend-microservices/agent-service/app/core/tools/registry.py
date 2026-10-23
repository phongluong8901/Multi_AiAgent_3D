from typing import Dict, Any
from .base_tool import BaseTool
from .calculator import CalculatorTool
from .web_crawler import WebCrawlerTool
# from .sentiment_tool import SentimentTool
from .text_summarizer import TextSummarizerTool
from .tools_api.web_search_tool import WebSearchTool
from .tools_api.google_search_tool import GoogleSearchTool

class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        # Đăng ký các tool
        self.register(CalculatorTool())
        self.register(WebCrawlerTool())
        # self.register(SentimentTool())
        summarizer = TextSummarizerTool()
        self.register(summarizer)
        self._tools["summarizer_tool"] = summarizer

        #api tool
        self.register(WebSearchTool())
        self.register(GoogleSearchTool())
        
        

    def register(self, tool: BaseTool):
        self._tools[tool.name] = tool

    def execute(self, tool_id: str, arguments: Dict[str, Any]) -> str:
        tool = self._tools.get(tool_id)
        if not tool:
            return f'{{"success": false, "error": "Tool {tool_id} not found in registry"}}'
        return tool.execute(arguments)

tool_registry = ToolRegistry()

# {
#   "tool_id": "text_summarizer",
#   "arguments": {
#     "text": "Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to the natural intelligence displayed by animals including humans. AI research has been highly successful in developing various techniques for solving a wide range of problems, from game playing to medical diagnosis. As technology continues to evolve rapidly across the globe, industries are adopting automation and machine learning algorithms to streamline operations, reduce human error, and optimize complex data processing workflows at scale."
#   }
# }