from typing import Dict, Any
from .base_tool import BaseTool
from .calculator import CalculatorTool
from .web_crawler import WebCrawlerTool
# from .sentiment_tool import SentimentTool
from .text_summarizer import TextSummarizerTool
from .tools_api.web_search_tool import WebSearchTool
from .tools_api.google_search_tool import GoogleSearchTool
from .data_analysis_tool import DataAnalysisTool
from .ml_evaluator_tool import MLEvaluatorTool
from .workflow_planner_tool import WorkflowPlannerTool
from .data_visualization_tool import DataVisualizationTool

class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        # 1. Công cụ Tính toán
        self.register(CalculatorTool())
        
        # 2. Công cụ Tóm tắt
        summarizer = TextSummarizerTool()
        self.register(summarizer)
        self._tools["summarizer_tool"] = summarizer
        self._tools["text_summarizer"] = summarizer

        # 3. Công cụ Tìm kiếm & Web
        self.register(WebSearchTool())
        self.register(GoogleSearchTool())
        self.register(WebCrawlerTool())
        self._tools["crawler_tool"] = self._tools["web_crawler_tool"]

        # 4. Công cụ Phân tích dữ liệu & Thống kê
        self.register(DataAnalysisTool())
        self._tools["analysis_tool"] = self._tools["data_analysis_tool"]
        self._tools["db_query_tool"] = self._tools["data_analysis_tool"]

        # 5. Công cụ Machine Learning & AI
        self.register(MLEvaluatorTool())
        self._tools["ml_tool"] = self._tools["ml_evaluator_tool"]

        # 6. Công cụ Lập kế hoạch & Quản lý cho Manager
        self.register(WorkflowPlannerTool())
        self._tools["system_control_tool"] = self._tools["workflow_planner_tool"]

        # 7. Công cụ Trực quan hóa Biểu đồ (Data Visualization)
        visualizer = DataVisualizationTool()
        self.register(visualizer)
        self._tools["visualization_tool"] = visualizer
        self._tools["chart_tool"] = visualizer
        self._tools["chart_visualizer_tool"] = visualizer
        
        

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