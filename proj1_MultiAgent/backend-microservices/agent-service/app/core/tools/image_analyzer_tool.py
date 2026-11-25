import os
import json
import base64
import logging
import urllib.request
from typing import Dict, Any, Optional
from .base_tool import BaseTool

logger = logging.getLogger(__name__)

class ImageAnalyzerTool(BaseTool):
    name = "image_analyzer_tool"
    description = (
        "Công cụ Thị giác máy tính (Computer Vision & OCR): "
        "1) OCR trích xuất toàn bộ chữ/văn bản từ ảnh tài liệu, hóa đơn, biển báo. "
        "2) Phân loại hình ảnh (Classification), nhận diện các vật thể/đối tượng và mô tả nội dung ảnh."
    )

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            image_url = arguments.get("image_url") or arguments.get("url") or arguments.get("file_url")
            image_path = arguments.get("image_path") or arguments.get("path")
            image_b64 = arguments.get("image_base64") or arguments.get("base64")
            task = str(arguments.get("task", "all")).lower()
            user_prompt = arguments.get("prompt") or arguments.get("question") or ""

            image_bytes = None
            mime_type = "image/jpeg"

            # 1. Thu thập dữ liệu byte của ảnh
            if image_url:
                try:
                    req = urllib.request.Request(
                        image_url,
                        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                    )
                    with urllib.request.urlopen(req, timeout=12) as response:
                        image_bytes = response.read()
                        content_type = response.headers.get_content_type()
                        if content_type:
                            mime_type = content_type
                except Exception as e:
                    return json.dumps({
                        "success": False,
                        "error": f"Không thể tải ảnh từ URL: {str(e)}"
                    }, ensure_ascii=False)

            elif image_path and os.path.exists(image_path):
                try:
                    with open(image_path, "rb") as f:
                        image_bytes = f.read()
                    if image_path.lower().endswith(".png"):
                        mime_type = "image/png"
                    elif image_path.lower().endswith(".webp"):
                        mime_type = "image/webp"
                except Exception as e:
                    return json.dumps({
                        "success": False,
                        "error": f"Không thể đọc file ảnh từ đường dẫn: {str(e)}"
                    }, ensure_ascii=False)

            elif image_b64:
                try:
                    if "," in image_b64:
                        header, image_b64 = image_b64.split(",", 1)
                        if "png" in header:
                            mime_type = "image/png"
                        elif "webp" in header:
                            mime_type = "image/webp"
                    image_bytes = base64.b64decode(image_b64)
                except Exception as e:
                    return json.dumps({
                        "success": False,
                        "error": f"Lỗi giải mã base64 ảnh: {str(e)}"
                    }, ensure_ascii=False)

            if not image_bytes:
                return json.dumps({
                    "success": False,
                    "error": "Vui lòng cung cấp ít nhất một nguồn ảnh: image_url, image_path hoặc image_base64."
                }, ensure_ascii=False)

            # 2. Xây dựng prompt hướng dẫn phân tích cho mô hình Vision
            system_prompt = (
                "Bạn là chuyên gia Thị giác máy tính (Computer Vision) và OCR hàng đầu. "
                "Hãy phân tích bức ảnh được cung cấp một cách tỉ mỉ, khách quan, chính xác cao theo định dạng JSON:\n"
                "{\n"
                "  \"ocr_text\": \"Toàn bộ chữ, số, văn bản có trong ảnh, giữ nguyên cấu trúc dòng, bảng biểu (hoặc để rỗng nếu không có chữ)\",\n"
                "  \"has_text\": true/false,\n"
                "  \"classification\": {\n"
                "    \"primary_category\": \"Danh mục chính của ảnh (ví dụ: Hóa đơn, Chứng từ, Phong cảnh, Xe cộ, Chân dung, Biểu đồ, Giao diện phần mềm)\",\n"
                "    \"labels\": [\"nhãn 1\", \"nhãn 2\", \"nhãn 3\"],\n"
                "    \"confidence_score\": 0.95,\n"
                "    \"scene_description\": \"Mô tả ngắn gọn bối cảnh và toàn cảnh bức ảnh bằng tiếng Việt\"\n"
                "  },\n"
                "  \"objects_detected\": [\"vật thể 1\", \"vật thể 2\"],\n"
                "  \"detailed_analysis\": \"Phân tích chi tiết và giải đáp cụ thể câu hỏi nếu có\"\n"
                "}"
            )

            instruction = system_prompt
            if task == "ocr":
                instruction += "\nĐẶC BIỆT CHÚ TRỌNG: Nhiệm vụ chính là OCR. Hãy trích xuất từng con chữ, dòng số, bảng biểu chính xác 100%."
            elif task == "classification":
                instruction += "\nĐẶC BIỆT CHÚ TRỌNG: Nhiệm vụ chính là phân loại (Classification), phân tích cảnh quan và liệt kê các vật thể có trong ảnh."

            if user_prompt:
                instruction += f"\nCâu hỏi / Yêu cầu cụ thể từ người dùng: {user_prompt}"

            # 3. Kích hoạt Gemini Multimodal Vision API
            from google import genai
            from google.genai import types

            api_key = os.getenv("GOOGLE_API_KEY_MODEL", "")
            client = genai.Client(api_key=api_key) if api_key else genai.Client()

            vision_models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
            last_err = None

            for v_model in vision_models:
                try:
                    response = client.models.generate_content(
                        model=v_model,
                        contents=[
                            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                            instruction
                        ],
                        config=types.GenerateContentConfig(
                            temperature=0.1,
                            response_mime_type="application/json"
                        )
                    )

                    if response and response.text:
                        parsed = json.loads(response.text)
                        return json.dumps({
                            "success": True,
                            "model_used": v_model,
                            "analysis": parsed
                        }, ensure_ascii=False)
                except Exception as ex:
                    last_err = ex
                    logger.warning(f"[ImageAnalyzerTool] Model {v_model} failed: {ex}. Trying fallback...")

            return json.dumps({
                "success": False,
                "error": f"Không thể phân tích ảnh qua Vision API: {str(last_err)}"
            }, ensure_ascii=False)

        except Exception as e:
            logger.error(f"[ImageAnalyzerTool] Error: {str(e)}")
            return json.dumps({
                "success": False,
                "error": str(e)
            }, ensure_ascii=False)
