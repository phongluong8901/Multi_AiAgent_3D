"""Word (.docx) & PowerPoint (.pptx) Document Reader and Generator."""
import os
from typing import Any

TOOL_SCHEMA: dict[str, Any] = {
    "name": "skill_office_com_word_ppt",
    "description": (
        "Đọc và tạo mới tài liệu Word (.docx) và bài thuyết trình PowerPoint (.pptx) trên Windows: "
        "trích xuất nội dung file docx, tạo báo cáo Word có tiêu đề và mục lục, tạo slide PowerPoint từ dàn ý. "
        "Read/create Word (.docx) documents and PowerPoint (.pptx) slide decks."
    ),
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["read_docx", "create_docx", "create_pptx"]},
            "file_path": {"type": "string", "description": "Đường dẫn tệp .docx hoặc .pptx."},
            "title": {"type": "string", "description": "Tiêu đề tài liệu Word."},
            "sections": {"type": "array", "description": "Danh sách mục [{'heading': '...', 'body': '...'}]."},
            "slides": {"type": "array", "description": "Danh sách slide [{'title': '...', 'bullets': ['...']}]."},
        },
        "required": ["action"],
    },
}


def read_docx(file_path: str) -> dict[str, Any]:
    if not file_path or not os.path.isfile(file_path):
        return {"ok": False, "error": f"File not found: {file_path}"}
    try:
        import docx  # type: ignore
    except ImportError:
        return {"ok": False, "error": "Missing package python-docx (pip install python-docx)"}
    doc = docx.Document(file_path)
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text and p.text.strip()]
    tables = []
    for tbl in doc.tables:
        tables.append([[c.text.strip() for c in row.cells] for row in tbl.rows])
    return {"ok": True, "path": os.path.abspath(file_path), "paragraphs": paragraphs, "text": "\n".join(paragraphs), "tables_count": len(tables), "tables": tables[:10]}


def create_docx(file_path: str, title: str = "Report", sections: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    if not file_path:
        return {"ok": False, "error": "Missing file_path"}
    try:
        import docx  # type: ignore
    except ImportError:
        return {"ok": False, "error": "Missing package python-docx (pip install python-docx)"}
    doc = docx.Document()
    doc.add_heading(title or "Report", level=0)
    for sec in sections or []:
        if sec.get("heading"):
            doc.add_heading(str(sec["heading"]), level=1)
        if sec.get("body"):
            doc.add_paragraph(str(sec["body"]))
    out = os.path.abspath(file_path)
    if os.path.dirname(out):
        os.makedirs(os.path.dirname(out), exist_ok=True)
    doc.save(out)
    return {"ok": True, "path": out, "sections_written": len(sections or [])}


def create_pptx(file_path: str, slides: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    if not file_path:
        return {"ok": False, "error": "Missing file_path"}
    try:
        from pptx import Presentation  # type: ignore
    except ImportError:
        return {"ok": False, "error": "Missing package python-pptx (pip install python-pptx)"}
    prs = Presentation()
    layout = prs.slide_layouts[1] if len(prs.slide_layouts) > 1 else prs.slide_layouts[0]
    for s in slides or []:
        slide = prs.slides.add_slide(layout)
        if getattr(slide.shapes, "title", None) is not None:
            slide.shapes.title.text = str(s.get("title", ""))
        bullets = s.get("bullets") or []
        if bullets and len(slide.placeholders) > 1:
            tf = slide.placeholders[1].text_frame
            tf.text = str(bullets[0])
            for b in bullets[1:]:
                p = tf.add_paragraph()
                p.text = str(b)
    out = os.path.abspath(file_path)
    if os.path.dirname(out):
        os.makedirs(os.path.dirname(out), exist_ok=True)
    prs.save(out)
    return {"ok": True, "path": out, "slides_created": len(slides or [])}


def execute(action: str = "read_docx", **kwargs: Any) -> dict[str, Any]:
    act = (action or "read_docx").strip().lower()
    try:
        if act == "read_docx":
            return read_docx(kwargs.get("file_path", ""))
        if act == "create_docx":
            return create_docx(kwargs.get("file_path", "report.docx"), kwargs.get("title", "Report"), kwargs.get("sections"))
        if act == "create_pptx":
            return create_pptx(kwargs.get("file_path", "slides.pptx"), kwargs.get("slides"))
        return {"ok": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
