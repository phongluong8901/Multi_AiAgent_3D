"""PDF Toolkit: inspect metadata, extract text by page range, merge, and split PDF files."""
import os
from typing import Any

TOOL_SCHEMA: dict[str, Any] = {
    "name": "skill_pdf_toolkit",
    "description": (
        "Xử lý tệp PDF trên Windows: xem số trang và thông tin PDF, trích xuất văn bản theo khoảng trang, "
        "gộp nhiều file PDF thành một (merge) và tách trang PDF (split). "
        "PDF toolkit: get_pdf_info, extract_text, merge_pdfs, split_pdf."
    ),
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["get_pdf_info", "extract_text", "merge_pdfs", "split_pdf"]},
            "file_path": {"type": "string", "description": "Đường dẫn tệp PDF."},
            "start_page": {"type": "integer", "description": "Trang bắt đầu (tính từ 1)."},
            "end_page": {"type": "integer", "description": "Trang kết thúc (tính từ 1)."},
            "input_paths": {"type": "array", "items": {"type": "string"}, "description": "Danh sách file PDF cần gộp."},
            "output_path": {"type": "string", "description": "Đường dẫn tệp PDF đầu ra."},
        },
        "required": ["action"],
    },
}


def get_pdf_info(file_path: str) -> dict[str, Any]:
    if not file_path or not os.path.isfile(file_path):
        return {"ok": False, "error": f"PDF not found: {file_path}"}
    try:
        from pypdf import PdfReader  # type: ignore
    except ImportError:
        return {"ok": False, "error": "Missing package pypdf (pip install pypdf)"}
    reader = PdfReader(file_path)
    meta = {k.lstrip("/"): str(v) for k, v in (reader.metadata or {}).items()}
    return {"ok": True, "path": os.path.abspath(file_path), "pages": len(reader.pages), "metadata": meta}


def extract_text(file_path: str, start_page: int = 1, end_page: int = 5) -> dict[str, Any]:
    if not file_path or not os.path.isfile(file_path):
        return {"ok": False, "error": f"PDF not found: {file_path}"}
    try:
        from pypdf import PdfReader  # type: ignore
    except ImportError:
        return {"ok": False, "error": "Missing package pypdf (pip install pypdf)"}
    reader = PdfReader(file_path)
    total = len(reader.pages)
    s = max(1, int(start_page or 1))
    e = min(total, max(s, int(end_page or total)))
    pages_out = []
    for idx in range(s - 1, e):
        pages_out.append({"page": idx + 1, "text": (reader.pages[idx].extract_text() or "").strip()})
    return {"ok": True, "total_pages": total, "range": [s, e], "pages": pages_out, "text": "\n\n".join(p["text"] for p in pages_out)}


def merge_pdfs(input_paths: list[str], output_path: str = "merged.pdf") -> dict[str, Any]:
    if not input_paths:
        return {"ok": False, "error": "input_paths cannot be empty"}
    try:
        from pypdf import PdfReader, PdfWriter  # type: ignore
    except ImportError:
        return {"ok": False, "error": "Missing package pypdf (pip install pypdf)"}
    writer = PdfWriter()
    merged_pages = 0
    for p in input_paths:
        if not os.path.isfile(p):
            return {"ok": False, "error": f"Missing input PDF: {p}"}
        r = PdfReader(p)
        for pg in r.pages:
            writer.add_page(pg)
            merged_pages += 1
    out = os.path.abspath(output_path or "merged.pdf")
    with open(out, "wb") as f:
        writer.write(f)
    return {"ok": True, "output_path": out, "files_merged": len(input_paths), "total_pages": merged_pages}


def split_pdf(file_path: str, start_page: int = 1, end_page: int = 1, output_path: str = "split.pdf") -> dict[str, Any]:
    if not file_path or not os.path.isfile(file_path):
        return {"ok": False, "error": f"PDF not found: {file_path}"}
    try:
        from pypdf import PdfReader, PdfWriter  # type: ignore
    except ImportError:
        return {"ok": False, "error": "Missing package pypdf (pip install pypdf)"}
    reader = PdfReader(file_path)
    s = max(1, int(start_page or 1))
    e = min(len(reader.pages), max(s, int(end_page or s)))
    writer = PdfWriter()
    for idx in range(s - 1, e):
        writer.add_page(reader.pages[idx])
    out = os.path.abspath(output_path or "split.pdf")
    with open(out, "wb") as f:
        writer.write(f)
    return {"ok": True, "output_path": out, "pages_extracted": e - s + 1}


def execute(action: str = "get_pdf_info", **kwargs: Any) -> dict[str, Any]:
    act = (action or "get_pdf_info").strip().lower()
    try:
        if act == "get_pdf_info":
            return get_pdf_info(kwargs.get("file_path", ""))
        if act == "extract_text":
            return extract_text(kwargs.get("file_path", ""), kwargs.get("start_page", 1), kwargs.get("end_page", 5))
        if act == "merge_pdfs":
            return merge_pdfs(kwargs.get("input_paths", []), kwargs.get("output_path", "merged.pdf"))
        if act == "split_pdf":
            return split_pdf(kwargs.get("file_path", ""), kwargs.get("start_page", 1), kwargs.get("end_page", 1), kwargs.get("output_path", "split.pdf"))
        return {"ok": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
