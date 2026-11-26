"""Smart File Operations: search files, organize folder by extension (with detailed dry_run), batch rename, undo."""
import fnmatch
import json
import os
import shutil
from datetime import datetime
from typing import Any

TOOL_SCHEMA: dict[str, Any] = {
    "name": "skill_smart_file_ops",
    "description": (
        "Thao tác tệp tin và thư mục thông minh trên Windows: tìm kiếm file theo mẫu (*.md, *.pdf...), "
        "dọn dẹp và phân loại thư mục (như Downloads/Desktop) theo đuôi file với chế độ chạy thử dry_run xem trước chi tiết, "
        "đổi tên hàng loạt và hoàn tác (undo). "
        "Smart file operations: search_files (default root='.'), organize_by_ext with dry_run preview, batch_rename, undo_last."
    ),
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["search_files", "organize_by_ext", "batch_rename", "undo_last"],
                "description": "Hành động cần thực thi.",
            },
            "root": {"type": "string", "description": "Thư mục gốc để tìm file (mặc định: '.')."},
            "pattern": {"type": "string", "description": "Mẫu tên file glob, ví dụ '*.md', '*report*' (mặc định: '*')."},
            "max_results": {"type": "integer", "description": "Số kết quả tối đa (mặc định: 50)."},
            "folder": {"type": "string", "description": "Đường dẫn thư mục cần dọn/đổi tên (mặc định: thư mục Downloads hoặc '.')."},
            "dry_run": {"type": "boolean", "description": "True = chỉ mô phỏng xem trước, không sửa thật (mặc định: True)."},
            "find_str": {"type": "string", "description": "Chuỗi cần tìm khi batch_rename."},
            "replace_str": {"type": "string", "description": "Chuỗi thay thế khi batch_rename."},
        },
        "required": ["action"],
    },
}

EXT_GROUPS = {
    "Images": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico"},
    "Documents": {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".md", ".csv"},
    "Archives": {".zip", ".rar", ".7z", ".tar", ".gz"},
    "Installers": {".exe", ".msi", ".msix", ".bat"},
    "Videos": {".mp4", ".mkv", ".avi", ".mov", ".webm"},
    "Audio": {".mp3", ".wav", ".flac", ".m4a", ".ogg"},
    "Code": {".py", ".js", ".ts", ".json", ".yaml", ".yml", ".html", ".css", ".sql", ".sh", ".ps1"},
}


def _resolve_folder(folder: str | None, default_downloads: bool = False) -> str:
    if folder and folder.strip():
        return os.path.expanduser(folder.strip())
    if default_downloads:
        dl = os.path.join(os.path.expanduser("~"), "Downloads")
        if os.path.isdir(dl):
            return dl
    return "."


def search_files(root: str = ".", pattern: str = "*", max_results: int = 50) -> dict[str, Any]:
    base = _resolve_folder(root, default_downloads=False)
    pat = (pattern or "*").strip()
    limit = max(1, min(int(max_results or 50), 500))
    if not os.path.isdir(base):
        return {"ok": False, "error": f"Directory not found: {base}"}

    matches = []
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules", "__pycache__", ".venv", "venv")]
        for fn in filenames:
            if fnmatch.fnmatch(fn.lower(), pat.lower()):
                matches.append(os.path.join(dirpath, fn))
                if len(matches) >= limit:
                    return {"ok": True, "root": os.path.abspath(base), "pattern": pat, "count": len(matches), "truncated": True, "files": matches}
    return {"ok": True, "root": os.path.abspath(base), "pattern": pat, "count": len(matches), "truncated": False, "files": matches}


def organize_by_ext(folder: str | None = None, dry_run: bool = True) -> dict[str, Any]:
    target = _resolve_folder(folder, default_downloads=True)
    if not os.path.isdir(target):
        return {"ok": False, "error": f"Folder not found: {target}"}

    plan = []
    summary: dict[str, int] = {}
    for entry in sorted(os.listdir(target)):
        src = os.path.join(target, entry)
        if not os.path.isfile(src) or entry.startswith(".") or entry == "_undo_manifest.json":
            continue
        ext = os.path.splitext(entry)[1].lower()
        cat = "Others"
        for gname, exts in EXT_GROUPS.items():
            if ext in exts:
                cat = gname
                break
        dst_dir = os.path.join(target, cat)
        dst = os.path.join(dst_dir, entry)
        plan.append({"from": src, "to": dst, "category": cat})
        summary[cat] = summary.get(cat, 0) + 1

    if not dry_run and plan:
        executed = []
        for item in plan:
            os.makedirs(os.path.dirname(item["to"]), exist_ok=True)
            dst = item["to"]
            if os.path.exists(dst):
                stem, ext = os.path.splitext(dst)
                dst = f"{stem}_{datetime.now().strftime('%H%M%S')}{ext}"
            shutil.move(item["from"], dst)
            executed.append({"from": item["from"], "to": dst})
        with open(os.path.join(target, "_undo_manifest.json"), "w", encoding="utf-8") as f:
            json.dump({"timestamp": datetime.now().isoformat(), "moves": executed}, f, ensure_ascii=False, indent=2)

    return {
        "ok": True,
        "folder": os.path.abspath(target),
        "dry_run": bool(dry_run),
        "total_files": len(plan),
        "summary_by_category": summary,
        "planned_moves": plan[:40],
        "note": "Simulation only (dry_run=True), no files were moved." if dry_run else "Files moved; undo manifest saved.",
    }


def batch_rename(folder: str = ".", find_str: str = "", replace_str: str = "", dry_run: bool = True) -> dict[str, Any]:
    target = _resolve_folder(folder)
    if not find_str:
        return {"ok": False, "error": "find_str cannot be empty"}
    if not os.path.isdir(target):
        return {"ok": False, "error": f"Folder not found: {target}"}

    plan = []
    for entry in sorted(os.listdir(target)):
        src = os.path.join(target, entry)
        if os.path.isfile(src) and find_str in entry:
            new_name = entry.replace(find_str, replace_str)
            if new_name != entry:
                plan.append({"from": src, "to": os.path.join(target, new_name)})

    if not dry_run and plan:
        for item in plan:
            if not os.path.exists(item["to"]):
                os.rename(item["from"], item["to"])
        with open(os.path.join(target, "_undo_manifest.json"), "w", encoding="utf-8") as f:
            json.dump({"timestamp": datetime.now().isoformat(), "moves": plan}, f, ensure_ascii=False, indent=2)

    return {"ok": True, "folder": os.path.abspath(target), "dry_run": bool(dry_run), "total_renames": len(plan), "planned_renames": plan[:40]}


def undo_last(folder: str | None = None) -> dict[str, Any]:
    target = _resolve_folder(folder, default_downloads=True)
    mpath = os.path.join(target, "_undo_manifest.json")
    if not os.path.exists(mpath):
        return {"ok": False, "error": f"No undo manifest found in {target}"}
    data = json.load(open(mpath, encoding="utf-8"))
    restored = 0
    for item in reversed(data.get("moves", [])):
        if os.path.exists(item["to"]) and not os.path.exists(item["from"]):
            shutil.move(item["to"], item["from"])
            restored += 1
    return {"ok": True, "restored": restored}


def execute(action: str = "search_files", **kwargs: Any) -> dict[str, Any]:
    act = (action or "search_files").strip().lower()
    try:
        if act == "search_files":
            return search_files(
                root=kwargs.get("root", "."),
                pattern=kwargs.get("pattern", "*"),
                max_results=kwargs.get("max_results", 50),
            )
        if act == "organize_by_ext":
            return organize_by_ext(folder=kwargs.get("folder"), dry_run=kwargs.get("dry_run", True))
        if act == "batch_rename":
            return batch_rename(
                folder=kwargs.get("folder", "."),
                find_str=kwargs.get("find_str", ""),
                replace_str=kwargs.get("replace_str", ""),
                dry_run=kwargs.get("dry_run", True),
            )
        if act == "undo_last":
            return undo_last(folder=kwargs.get("folder"))
        return {"ok": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
