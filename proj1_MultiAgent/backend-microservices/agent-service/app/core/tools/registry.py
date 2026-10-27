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
from .image_analyzer_tool import ImageAnalyzerTool
from .csv_analyzer_tool import CSVAnalyzerTool
from .python_code_generator_tool import PythonCodeGeneratorTool
from .python_sandbox_tool import PythonSandboxTool
from .pdf_analyzer_tool import PDFAnalyzerTool
import json

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

        # 8. Công cụ OCR & Phân tích Hình ảnh (Image Vision & Classification)
        image_analyzer = ImageAnalyzerTool()
        self.register(image_analyzer)
        self._tools["vision_tool"] = image_analyzer
        self._tools["ocr_tool"] = image_analyzer
        self._tools["image_classifier_tool"] = image_analyzer

        # 9. Công cụ Phân tích File CSV (CSV Analyzer & Profiler)
        csv_analyzer = CSVAnalyzerTool()
        self.register(csv_analyzer)
        self._tools["csv_tool"] = csv_analyzer
        self._tools["csv_analysis_tool"] = csv_analyzer

        # 10. Công cụ Sinh mã nguồn Python (Python Code Generator)
        code_gen = PythonCodeGeneratorTool()
        self.register(code_gen)
        self._tools["code_generator_tool"] = code_gen
        self._tools["python_generator_tool"] = code_gen

        # 11. Công cụ Sandbox Thực thi Code An toàn (Isolated Python Sandbox)
        sandbox_tool = PythonSandboxTool()
        self.register(sandbox_tool)
        self._tools["code_runner_tool"] = sandbox_tool
        self._tools["sandbox_tool"] = sandbox_tool
        self._tools["sandbox_executor_tool"] = sandbox_tool

        # 12. Công cụ Phân tích Tài liệu PDF & OCR Bảng biểu (PDF Analyzer)
        pdf_analyzer = PDFAnalyzerTool()
        self.register(pdf_analyzer)
        self._tools["pdf_tool"] = pdf_analyzer
        self._tools["tool_pdf"] = pdf_analyzer
        self._tools["tool_pdf_analyzer"] = pdf_analyzer
        self._tools["pdf_reader_tool"] = pdf_analyzer
        self._tools["document_analyzer_tool"] = pdf_analyzer

        # 13. Tự động nạp động các Tool được sinh trong app/generated/tools/
        self.load_generated_tools()

    def register(self, tool: BaseTool):
        self._tools[tool.name] = tool

    def load_generated_tools(self):
        """Quét và nạp động toàn bộ các file tool Python trong app/generated/tools/"""
        import os
        import glob
        import importlib.util
        gen_dir = os.path.abspath(
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "generated", "tools")
        )
        if not os.path.exists(gen_dir):
            return

        for py_path in glob.glob(os.path.join(gen_dir, "*.py")):
            fname = os.path.basename(py_path)
            if fname.startswith("__"):
                continue
            tool_name = fname[:-3]
            try:
                spec = importlib.util.spec_from_file_location(f"app.generated.tools.{tool_name}", py_path)
                if spec and spec.loader:
                    mod = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(mod)
                    # Tìm class kế thừa BaseTool
                    registered = False
                    for attr_name in dir(mod):
                        attr = getattr(mod, attr_name)
                        if isinstance(attr, type) and issubclass(attr, BaseTool) and attr is not BaseTool:
                            instance = attr()
                            self.register(instance)
                            registered = True
                            break
                    if not registered and hasattr(mod, "execute"):
                        class GenWrapperTool(BaseTool):
                            name = tool_name
                            description = getattr(mod, "__doc__", f"Tool {tool_name}")
                            def execute(self, arguments: Dict[str, Any]) -> str:
                                res = mod.execute(arguments)
                                return res if isinstance(res, str) else json.dumps(res, ensure_ascii=False)
                        self.register(GenWrapperTool())
            except Exception as e:
                pass

    def execute(self, tool_id: str, arguments: Dict[str, Any]) -> str:
        tool = self._tools.get(tool_id)
        if not tool:
            # Thử nạp lại các tool trong app/generated/tools/ phòng khi vừa được sinh mới
            try:
                self.load_generated_tools()
            except Exception:
                pass
            tool = self._tools.get(tool_id)

        if not tool:
            # Tìm kiếm thông minh theo từ khóa (Fuzzy Matching cho các tool tự sinh từ Lab hoặc UI)
            tid_lower = str(tool_id).lower()
            if "pdf" in tid_lower or "ph_n_t" in tid_lower or "tailieu" in tid_lower or "document" in tid_lower:
                tool = self._tools.get("pdf_analyzer_tool")
            elif "csv" in tid_lower or "excel" in tid_lower:
                tool = self._tools.get("csv_analyzer_tool")
            elif "code" in tid_lower or "lap_trinh" in tid_lower:
                tool = self._tools.get("python_code_generator_tool")
            elif "sandbox" in tid_lower or "runner" in tid_lower:
                tool = self._tools.get("python_sandbox_tool")
            elif "ocr" in tid_lower or "vision" in tid_lower or "anh" in tid_lower or "image" in tid_lower:
                tool = self._tools.get("image_analyzer_tool")
            elif "search" in tid_lower or "tim_kiem" in tid_lower or "tra_cuu" in tid_lower:
                tool = self._tools.get("google_search_tool") or self._tools.get("web_search_tool")
            elif "summari" in tid_lower or "tom_tat" in tid_lower:
                tool = self._tools.get("text_summarizer")

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