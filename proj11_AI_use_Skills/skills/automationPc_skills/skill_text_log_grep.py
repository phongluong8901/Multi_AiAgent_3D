"""Fast Recursive Text/Regex Grep across Workspace & Log File Tail Reader."""
import fnmatch
import os
import re
from collections import deque
from typing import Any

SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", ".pytest_cache"}

TOOL_SCHEMA: dict[str, Any] = {
    "name": "skill_text_log_grep",
    "description": (
        "Tìm kiếm nội dung văn bản hoặc biểu thức chính quy (grep regex) bên trong hàng loạt file code/log kèm số dòng, "
        "và đọc nhanh N dòng cuối cùng của file log (tail). "
        "Recursive text/regex grep across files and tail_file log reader."
    ),
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["grep_text", "tail_file"]},
            "query": {"type": "string", "description": "Chuỗi hoặc regex cần tìm trong nội dung file."},
            "root": {"type": "string", "description": "Thư mục gốc cần quét (mặc định: '.')."},
            "glob_pattern": {"type": "string", "description": "Mẫu đuôi file, vd '*.py', '*.log' (mặc định: '*')."},
            "is_regex": {"type": "boolean", "description": "Bật chế độ regex (mặc định: False)."},
            "max_hits": {"type": "integer", "description": "Số dòng khớp tối đa (mặc định: 50)."},
            "file_path": {"type": "string", "description": "Đường dẫn file log cần đọc cuối file khi action='tail_file'."},
            "lines": {"type": "integer", "description": "Số dòng cuối cần đọc (mặc định: 50)."},
        },
        "required": ["action"],
    },
}


def grep_text(query: str, root: str = ".", glob_pattern: str = "*", is_regex: bool = False, max_hits: int = 50) -> dict[str, Any]:
    if not query:
        return {"ok": False, "error": "query cannot be empty"}
    base = os.path.expanduser(root or ".")
    if not os.path.isdir(base):
        return {"ok": False, "error": f"Directory not found: {base}"}
    pat = re.compile(query if is_regex else re.escape(query), re.IGNORECASE)
    limit = max(1, min(int(max_hits or 50), 500))
    hits = []
    for dp, dns, fns in os.walk(base):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for fn in fns:
            if not fnmatch.fnmatch(fn.lower(), (glob_pattern or "*").lower()):
                continue
            fp = os.path.join(dp, fn)
            try:
                if os.path.getsize(fp) > 5 * 1024 * 1024:
                    continue
                with open(fp, "r", encoding="utf-8", errors="ignore") as f:
                    for lineno, line in enumerate(f, 1):
                        if pat.search(line):
                            hits.append({"file": fp, "line": lineno, "text": line.strip()[:240]})
                            if len(hits) >= limit:
                                return {"ok": True, "count": len(hits), "truncated": True, "hits": hits}
            except OSError:
                continue
    return {"ok": True, "count": len(hits), "truncated": False, "hits": hits}


def tail_file(file_path: str, lines: int = 50) -> dict[str, Any]:
    if not file_path or not os.path.isfile(file_path):
        return {"ok": False, "error": f"File not found: {file_path}"}
    n = max(1, min(int(lines or 50), 1000))
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        tail = list(deque((ln.rstrip("\r\n") for ln in f), maxlen=n))
    return {"ok": True, "file": os.path.abspath(file_path), "lines_returned": len(tail), "content": "\n".join(tail)}


def execute(action: str = "grep_text", **kwargs: Any) -> dict[str, Any]:
    act = (action or "grep_text").strip().lower()
    try:
        if act == "grep_text":
            return grep_text(
                query=kwargs.get("query", ""),
                root=kwargs.get("root", "."),
                glob_pattern=kwargs.get("glob_pattern", "*"),
                is_regex=kwargs.get("is_regex", False),
                max_hits=kwargs.get("max_hits", 50),
            )
        if act == "tail_file":
            return tail_file(kwargs.get("file_path", ""), kwargs.get("lines", 50))
        return {"ok": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
