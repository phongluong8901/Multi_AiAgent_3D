import os
import re
import json
import logging
import urllib.request
from typing import Dict, Any, Optional
from .base_tool import BaseTool

logger = logging.getLogger(__name__)

class PDFAnalyzerTool(BaseTool):
    name = "pdf_analyzer_tool"
    description = (
        "Công cụ Phân tích Tài liệu PDF & OCR Văn bản Bảng biểu: "
        "Đọc file PDF từ đường dẫn URL (như Cloudinary) hoặc file nội bộ. "
        "Trích xuất toàn bộ văn bản, số liệu, bảng biểu báo cáo tài chính/doanh số và tóm tắt nội dung chính xác."
    )

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            pdf_url = (
                arguments.get("pdf_url")
                or arguments.get("file_url")
                or arguments.get("url")
                or arguments.get("file_path")
                or arguments.get("path")
                or arguments.get("input_text")
            )
            user_prompt = arguments.get("prompt") or arguments.get("question") or arguments.get("task") or ""

            # Nếu user truyền chuỗi chứa URL trong văn bản (ví dụ markdown [tên](https://...))
            if pdf_url and ("http://" in str(pdf_url) or "https://" in str(pdf_url)):
                match = re.search(r"https?://[^\s\)\"']+", str(pdf_url))
                if match:
                    pdf_url = match.group(0)

            # Nếu không tìm thấy trong arguments, quét trong prompt
            if not pdf_url and user_prompt:
                match = re.search(r"https?://[^\s\)\"']+", str(user_prompt))
                if match:
                    pdf_url = match.group(0)

            # Quét tìm trong toàn bộ các trường của arguments
            if not pdf_url:
                for k, v in arguments.items():
                    if isinstance(v, str) and ("http://" in v or "https://" in v):
                        match = re.search(r"https?://[^\s\)\"']+", v)
                        if match:
                            pdf_url = match.group(0)
                            break

            # Quét tìm trong Redis short memory nếu Manager chuyển giao mà không đính kèm lại URL
            if not pdf_url:
                try:
                    from app.services.memory_service import memory_service
                    for aid in ["agent_manager", "agent_pdf_analyzer", "agent_t_o_ra_agent_ph_n_t_"]:
                        recent = memory_service.get_short_memory(aid, None) or []
                        for m in reversed(recent):
                            content = m.get("content", "")
                            if "http://" in content or "https://" in content:
                                match = re.search(r"https?://[^\s\)\"']+", content)
                                if match:
                                    pdf_url = match.group(0)
                                    logger.info(f"🔍 [PDFAnalyzerTool] Tìm thấy PDF URL từ chat history: {pdf_url}")
                                    break
                        if pdf_url:
                            break
                except Exception:
                    pass

            pdf_bytes = None

            # 1. Tải file PDF từ URL hoặc đọc từ disk
            if pdf_url and (pdf_url.startswith("http://") or pdf_url.startswith("https://")):
                try:
                    logger.info(f"📥 [PDFAnalyzerTool] Đang tải file PDF từ URL: {pdf_url}")
                    req = urllib.request.Request(
                        pdf_url,
                        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                    )
                    with urllib.request.urlopen(req, timeout=25) as response:
                        pdf_bytes = response.read()
                except Exception as e:
                    return json.dumps({
                        "success": False,
                        "error": f"Không thể tải file PDF từ URL: {str(e)}"
                    }, ensure_ascii=False)
            elif pdf_url and os.path.exists(pdf_url):
                try:
                    with open(pdf_url, "rb") as f:
                        pdf_bytes = f.read()
                except Exception as e:
                    return json.dumps({
                        "success": False,
                        "error": f"Không thể đọc file PDF từ ổ đĩa: {str(e)}"
                    }, ensure_ascii=False)

            if not pdf_bytes:
                return json.dumps({
                    "success": False,
                    "error": "Không tìm thấy file PDF. Vui lòng cung cấp link URL hoặc đường dẫn file PDF hợp lệ."
                }, ensure_ascii=False)

            # 2. Xử lý phân tích qua Gemini Multimodal (hỗ trợ trực tiếp application/pdf)
            from google import genai
            from google.genai import types

            api_key = os.getenv("GOOGLE_API_KEY_MODEL", "")
            client = genai.Client(api_key=api_key) if api_key else genai.Client()

            instruction = (
                "Bạn là Chuyên gia Phân tích Tài liệu & Báo cáo PDF cao cấp (Senior Document Intelligence). "
                "Hãy đọc toàn bộ tài liệu PDF được gửi kèm và thực hiện các nhiệm vụ sau:\n"
                "1. Trích xuất toàn bộ văn bản quan trọng, tiêu đề, ngày tháng, thông tin tổ chức/doanh nghiệp.\n"
                "2. Trích xuất chi tiết các bảng biểu, số liệu kế toán, doanh thu, lợi nhuận, so sánh cùng kỳ (nếu có).\n"
                "3. Phân tích xu hướng, so sánh chỉ số tăng/giảm và rút ra nhận xét sắc bén.\n"
                "4. Định dạng câu trả lời chuẩn Markdown rõ ràng, thẩm mỹ, có bảng số liệu Markdown đẹp mắt.\n"
            )
            if user_prompt:
                instruction += f"\nYêu cầu đặc biệt từ người dùng: {user_prompt}"

            models_to_try = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash-lite"]
            last_err = None

            for m in models_to_try:
                try:
                    logger.info(f"🤖 [PDFAnalyzerTool] Đang phân tích PDF bằng model {m}...")
                    response = client.models.generate_content(
                        model=m,
                        contents=[
                            types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                            instruction
                        ]
                    )
                    if response and response.text:
                        return json.dumps({
                            "success": True,
                            "source": pdf_url or "uploaded_pdf",
                            "analysis_result": response.text,
                            "model_used": m
                        }, ensure_ascii=False)
                except Exception as ex:
                    logger.warning(f"⚠️ [PDFAnalyzerTool] Model {m} gặp sự cố: {ex}")
                    last_err = ex

            return json.dumps({
                "success": False,
                "error": f"Không thể phân tích PDF qua AI: {str(last_err)}"
            }, ensure_ascii=False)

        except Exception as e:
            logger.error(f"❌ [PDFAnalyzerTool] Error: {str(e)}", exc_info=True)
            return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)
