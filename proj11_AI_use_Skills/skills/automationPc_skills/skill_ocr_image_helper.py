"""Prepare, crop, inspect, and base64-encode images for Gemini Vision / OCR."""
import base64
import io
import os
from typing import Any

TOOL_SCHEMA: dict[str, Any] = {
    "name": "skill_ocr_image_helper",
    "description": (
        "Chuẩn bị ảnh gửi Gemini Vision đọc chữ OCR: cắt vùng ảnh (crop), thu gọn kích thước tối ưu, "
        "lấy thông tin độ phân giải và mã hóa base64. "
        "Image helper for Vision/OCR: inspect image info, crop region, resize and encode for vision analysis."
    ),
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["prepare_for_vision", "crop_image", "get_image_info"]},
            "image_path": {"type": "string", "description": "Đường dẫn tệp ảnh nguồn."},
            "max_dim": {"type": "integer", "description": "Cạnh tối đa sau khi resize (mặc định: 1280)."},
            "box": {"type": "array", "items": {"type": "integer"}, "description": "Vùng cắt [x1, y1, x2, y2]."},
            "output_path": {"type": "string", "description": "Đường dẫn ảnh đầu ra sau khi cắt."},
        },
        "required": ["action"],
    },
}


def get_image_info(image_path: str) -> dict[str, Any]:
    if not image_path or not os.path.isfile(image_path):
        return {"ok": False, "error": f"Image not found: {image_path}"}
    size_kb = round(os.path.getsize(image_path) / 1024.0, 2)
    try:
        from PIL import Image  # type: ignore
        with Image.open(image_path) as img:
            return {"ok": True, "path": os.path.abspath(image_path), "width": img.width, "height": img.height, "format": img.format, "size_kb": size_kb}
    except ImportError:
        return {"ok": True, "path": os.path.abspath(image_path), "size_kb": size_kb, "note": "Pillow not installed; dimensions unavailable"}


def prepare_for_vision(image_path: str, max_dim: int = 1280) -> dict[str, Any]:
    if not image_path or not os.path.isfile(image_path):
        return {"ok": False, "error": f"Image not found: {image_path}"}
    try:
        from PIL import Image  # type: ignore
        with Image.open(image_path) as img:
            img = img.convert("RGB")
            img.thumbnail((max(64, int(max_dim)), max(64, int(max_dim))))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            return {"ok": True, "path": os.path.abspath(image_path), "width": img.width, "height": img.height, "mime_type": "image/jpeg", "base64_len": len(b64), "base64_preview": b64[:80]}
    except ImportError:
        raw = open(image_path, "rb").read()
        b64 = base64.b64encode(raw).decode("ascii")
        return {"ok": True, "path": os.path.abspath(image_path), "base64_len": len(b64), "base64_preview": b64[:80], "note": "raw_fallback"}


def crop_image(image_path: str, box: list[int], output_path: str = "cropped.png") -> dict[str, Any]:
    if not image_path or not os.path.isfile(image_path):
        return {"ok": False, "error": f"Image not found: {image_path}"}
    if not isinstance(box, (list, tuple)) or len(box) != 4:
        return {"ok": False, "error": "box must be [x1, y1, x2, y2]"}
    x1, y1, x2, y2 = [int(v) for v in box]
    if x2 <= x1 or y2 <= y1:
        return {"ok": False, "error": "Invalid crop coordinates: x2 must be > x1 and y2 > y1"}
    try:
        from PIL import Image  # type: ignore
        with Image.open(image_path) as img:
            cropped = img.crop((x1, y1, x2, y2))
            out = os.path.abspath(output_path or "cropped.png")
            cropped.save(out)
            return {"ok": True, "path": out, "width": cropped.width, "height": cropped.height}
    except ImportError:
        return {"ok": False, "error": "Missing package Pillow (pip install pillow)"}


def execute(action: str = "get_image_info", **kwargs: Any) -> dict[str, Any]:
    act = (action or "get_image_info").strip().lower()
    try:
        if act == "get_image_info":
            return get_image_info(kwargs.get("image_path", ""))
        if act == "prepare_for_vision":
            return prepare_for_vision(kwargs.get("image_path", ""), max_dim=kwargs.get("max_dim", 1280))
        if act == "crop_image":
            return crop_image(kwargs.get("image_path", ""), kwargs.get("box", []), kwargs.get("output_path", "cropped.png"))
        return {"ok": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
