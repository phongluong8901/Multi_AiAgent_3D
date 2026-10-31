from .calculator import CalculatorTool
from .web_search import WebSearchTool
from .web_crawler import WebCrawlerTool
from .wikipedia_tool import WikipediaTool
from .data_analysis_tool import DataAnalysisTool
from .data_visualization_tool import DataVisualizationTool
from .csv_analyzer_tool import CSVAnalyzerTool
from .pdf_analyzer_tool import PDFAnalyzerTool
from .text_summarizer import TextSummarizerTool
from .workflow_planner_tool import WorkflowPlannerTool
from .python_code_generator_tool import PythonCodeGeneratorTool
from .python_sandbox_tool import PythonSandboxTool
from .ml_evaluator_tool import MLEvaluatorTool
from .image_analyzer_tool import ImageAnalyzerTool
from .sentiment_tool import SentimentTool
from .financial_market_tool import FinancialMarketTool
from .sql_query_generator_tool import SqlQueryGeneratorTool
from .json_data_transformer_tool import JsonDataTransformerTool
from .security_code_auditor_tool import SecurityCodeAuditorTool
from .system_health_tool import SystemHealthTool


class ToolRegistry:
    _tools = {
        # 1. Tìm kiếm, Thu thập Web & Bách khoa toàn thư
        "web_search_tool": WebSearchTool(),
        "google_search_tool": WebSearchTool(),
        "wikipedia_tool": WikipediaTool(),
        "web_crawler_tool": WebCrawlerTool(),

        # 2. Toán học & Phân tích Tài chính Đầu tư
        "calculator_tool": CalculatorTool(),
        "financial_market_tool": FinancialMarketTool(),

        # 3. Phân tích Thống kê, Trực quan hóa Biểu đồ, CSV, PDF, JSON & Cảm xúc
        "data_analysis_tool": DataAnalysisTool(),
        "data_visualization_tool": DataVisualizationTool(),
        "csv_analyzer_tool": CSVAnalyzerTool(),
        "pdf_analyzer_tool": PDFAnalyzerTool(),
        "json_data_transformer_tool": JsonDataTransformerTool(),
        "sentiment_analysis_tool": SentimentTool(),
        "sentiment_tool": SentimentTool(),

        # 4. Tóm tắt văn bản
        "summarizer_tool": TextSummarizerTool(),
        "text_summarizer_tool": TextSummarizerTool(),

        # 5. Điều phối Kế hoạch & Giám sát Sức khỏe Cụm Phân tán
        "workflow_planner_tool": WorkflowPlannerTool(),
        "system_health_tool": SystemHealthTool(),
        "system_control_tool": SystemHealthTool(),

        # 6. Lập trình Python, SQL, Kiểm toán Bảo mật & Thực thi Sandbox
        "python_code_generator_tool": PythonCodeGeneratorTool(),
        "python_sandbox_tool": PythonSandboxTool(),
        "sql_query_generator_tool": SqlQueryGeneratorTool(),
        "security_code_auditor_tool": SecurityCodeAuditorTool(),

        # 7. Học máy (ML) & Thị giác máy tính (Vision/OCR)
        "ml_evaluator_tool": MLEvaluatorTool(),
        "image_analyzer_tool": ImageAnalyzerTool(),
    }

    @classmethod
    def get_tool(cls, name: str):
        return cls._tools.get(name)

    @classmethod
    def list_tools(cls):
        return list(cls._tools.keys())

    @classmethod
    def load_generated_tools(cls, tools_dir: str | None = None) -> None:
        """Nạp động các tool được sinh tự động từ thư mục app/generated/tools/ vào registry"""
        import os
        import importlib.util

        if tools_dir is None:
            app_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            tools_dir = os.path.join(app_dir, "generated", "tools")

        if not os.path.exists(tools_dir):
            return

        for filename in os.listdir(tools_dir):
            if filename.endswith(".py") and not filename.startswith("__"):
                tool_id = filename[:-3]
                filepath = os.path.join(tools_dir, filename)
                try:
                    spec = importlib.util.spec_from_file_location(f"app.generated.tools.{tool_id}", filepath)
                    if spec and spec.loader:
                        module = importlib.util.module_from_spec(spec)
                        spec.loader.exec_module(module)
                        for attr_name in dir(module):
                            attr = getattr(module, attr_name)
                            if isinstance(attr, type) and hasattr(attr, "execute") and attr_name.endswith("Tool"):
                                cls._tools[tool_id] = attr()
                                break
                except Exception:
                    pass

    @classmethod
    def execute(cls, name: str, arguments: dict | None = None) -> str:
        import json
        tool = cls.get_tool(name)
        if not tool:
            return json.dumps({"success": False, "error": f"Tool '{name}' not found in registry"}, ensure_ascii=False)
        args = arguments or {}
        try:
            res = tool.execute(args)
            if isinstance(res, str):
                return res
            return json.dumps(res, ensure_ascii=False)
        except TypeError:
            res = tool.execute(**args)
            if isinstance(res, str):
                return res
            return json.dumps(res, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)


tool_registry = ToolRegistry()
