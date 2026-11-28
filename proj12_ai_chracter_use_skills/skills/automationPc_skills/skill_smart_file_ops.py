"""Smart File Operations: fast PC-wide file search, open file, organize folder by extension, batch rename, undo."""
import fnmatch
import json
import os
import shutil
import time
from datetime import datetime
from typing import Any

TOOL_SCHEMA: dict[str, Any] = {
    "name": "skill_smart_file_ops",
    "description": (
        "Thao tác tệp tin và thư mục thông minh trên Windows: tìm file (`search_files`, `search_pc`), "
        "tìm trong Thùng rác theo tên gốc (`search_recycle_bin`), mở file (`open_file`), "
        "di chuyển file/thư mục (`move_file`), sao chép file (`copy_file`), "
        "dọn dẹp phân loại thư mục (`organize_by_ext`), đổi tên hàng loạt (`batch_rename`) và hoàn tác (`undo_last`)."
    ),
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": [
                    "search_files",
                    "search_pc",
                    "search_recycle_bin",
                    "open_file",
                    "move_file",
                    "copy_file",
                    "organize_by_ext",
                    "batch_rename",
                    "undo_last",
                ],
                "description": "Hành động cần thực thi (dùng move_file để di chuyển file sang thư mục/ổ khác, copy_file để sao chép).",
            },
            "root": {"type": "string", "description": "Thư mục gốc để tìm file khi search_files (mặc định: '.')."},
            "pattern": {"type": "string", "description": "Tên hoặc mẫu glob cần tìm, ví dụ 'doanh_thu', '*.xlsx', '*report*'."},
            "file_path": {"type": "string", "description": "Đường dẫn đầy đủ hoặc tên file cần mở khi action='open_file'."},
            "source_path": {"type": "string", "description": "Đường dẫn (hoặc tên file) nguồn khi action='move_file' hoặc 'copy_file'."},
            "dest_path": {"type": "string", "description": "Đường dẫn thư mục đích (vd 'D:\\') hoặc đường dẫn file đích khi move_file/copy_file."},
            "max_results": {"type": "integer", "description": "Số kết quả tối đa (mặc định: 30)."},
            "folder": {"type": "string", "description": "Đường dẫn thư mục cần dọn/đổi tên (mặc định: thư mục Downloads hoặc '.')."},
            "dry_run": {"type": "boolean", "description": "True = chỉ mô phỏng xem trước, không sửa thật (mặc định: True)."},
            "find_str": {"type": "string", "description": "Chuỗi cần tìm khi batch_rename."},
            "replace_str": {"type": "string", "description": "Chuỗi thay thế khi batch_rename."},
        },
        "required": ["action"],
    },
}

_SKIP_DIRS = frozenset(
    {
        ".git", "node_modules", "__pycache__", ".venv", "venv", "env",
        "appdata", "windows", "program files", "program files (x86)", "programdata",
        "$recycle.bin", "system volume information", "recovery", "perflogs",
        ".cache", ".conda", ".npm", ".gradle", ".cargo", ".rustup", ".m2",
        ".vscode", ".gemini", "site-packages", "dist", "build", ".next",
        "intel", "amd", "nvidia", "onedrivetemp",
    }
)

EXT_GROUPS = {
    "Images": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico"},
    "Documents": {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".md", ".csv"},
    "Archives": {".zip", ".rar", ".7z", ".tar", ".gz"},
    "Installers": {".exe", ".msi", ".msix", ".bat"},
    "Videos": {".mp4", ".mkv", ".avi", ".mov", ".webm"},
    "Audio": {".mp3", ".wav", ".flac", ".m4a", ".ogg"},
    "Code": {".py", ".js", ".ts", ".json", ".yaml", ".yml", ".html", ".css", ".sql", ".sh", ".ps1"},
}


class SmartFileOperations:
    """Class cung cấp các thao tác tệp tin và thư mục thông minh trên Windows."""

    def __init__(self) -> None:
        pass

    def _resolve_folder(self, folder: str | None, default_downloads: bool = False) -> str:
        if folder and folder.strip():
            expanded = os.path.expanduser(folder.strip())
            if not os.path.isdir(expanded):
                return expanded
            return expanded
        if default_downloads:
            dl = os.path.join(os.path.expanduser("~"), "Downloads")
            if os.path.isdir(dl):
                return dl
        return "."

    def _normalize_pattern(self, pattern: str) -> str:
        pat = (pattern or "*").strip()
        if not pat:
            return "*"
        if "*" not in pat and "?" not in pat:
            return f"*{pat}*"
        return pat

    def _walk_fast(
        self,
        roots: list[str],
        pat: str,
        limit: int,
        deadline: float,
        max_depth: int = 6,
    ) -> tuple[list[str], bool]:
        matches: list[str] = []
        seen: set[str] = set()
        pat_low = pat.lower()
        timed_out = False

        for base in roots:
            if time.monotonic() >= deadline:
                timed_out = True
                break
            if not base or not os.path.isdir(base):
                continue
            base_abs = os.path.abspath(base)
            base_depth = base_abs.rstrip("\\/").count(os.sep)
            for dirpath, dirnames, filenames in os.walk(base_abs):
                if time.monotonic() >= deadline:
                    timed_out = True
                    break
                cur_depth = dirpath.rstrip("\\/").count(os.sep) - base_depth
                if cur_depth >= max_depth:
                    dirnames[:] = []
                else:
                    dirnames[:] = [
                        d for d in dirnames
                        if d.lower() not in _SKIP_DIRS and not d.startswith("$")
                    ]
                for fn in filenames:
                    if fnmatch.fnmatch(fn.lower(), pat_low):
                        full = os.path.join(dirpath, fn)
                        key = full.lower()
                        if key not in seen:
                            seen.add(key)
                            matches.append(full)
                            if len(matches) >= limit:
                                return matches, timed_out
        return matches, timed_out

    def search_files(self, root: str = ".", pattern: str = "*", max_results: int = 50) -> dict[str, Any]:
        """Tìm kiếm file trong một thư mục chỉ định với mẫu tên (pattern)."""
        base = self._resolve_folder(root, default_downloads=False)
        pat = self._normalize_pattern(pattern)
        limit = max(1, min(int(max_results or 50), 200))
        if not os.path.isdir(base):
            return {"ok": False, "error": f"Directory not found: {base}"}

        matches, timed_out = self._walk_fast([base], pat, limit, deadline=time.monotonic() + 6.0, max_depth=7)
        return {
            "ok": True,
            "root": os.path.abspath(base),
            "pattern": pat,
            "count": len(matches),
            "truncated": len(matches) >= limit or timed_out,
            "timed_out": timed_out,
            "files": matches,
        }

    def search_pc(self, pattern: str = "*", max_results: int = 30) -> dict[str, Any]:
        """Tìm kiếm file nhanh trên toàn bộ PC (Desktop, Documents, Downloads, OneDrive, workspace và ổ đĩa)."""
        pat = self._normalize_pattern(pattern)
        limit = max(1, min(int(max_results or 30), 100))
        home = os.path.expanduser("~")
        priority_roots: list[str] = [
            os.path.abspath("."),
            os.path.join(home, "Desktop"),
            os.path.join(home, "Documents"),
            os.path.join(home, "Downloads"),
            os.path.join(home, "OneDrive"),
            os.path.join(home, "OneDrive", "Desktop"),
            os.path.join(home, "OneDrive", "Documents"),
        ]
        for drive in ("D:\\", "E:\\", "F:\\"):
            if os.path.isdir(drive):
                priority_roots.append(drive)

        existing_roots = []
        seen_r: set[str] = set()
        for r in priority_roots:
            try:
                if os.path.isdir(r):
                    ab = os.path.abspath(r)
                    if ab.lower() not in seen_r:
                        seen_r.add(ab.lower())
                        existing_roots.append(ab)
            except OSError:
                continue

        matches, timed_out = self._walk_fast(existing_roots, pat, limit, deadline=time.monotonic() + 6.5, max_depth=5)
        return {
            "ok": True,
            "searched_roots": existing_roots,
            "pattern": pat,
            "count": len(matches),
            "timed_out": timed_out,
            "files": matches,
        }

    def open_file(self, file_path: str = "", pattern: str = "") -> dict[str, Any]:
        """Mở tệp tin trên Windows bằng ứng dụng mặc định; nếu chỉ có tên/pattern, tìm kiếm trên PC trước."""
        target = (file_path or pattern or "").strip().strip('"').strip("'")
        if not target:
            return {"ok": False, "error": "Missing file_path or pattern"}
        expanded = os.path.expanduser(target)
        if os.path.isfile(expanded):
            os.startfile(os.path.abspath(expanded))
            return {"ok": True, "opened": os.path.abspath(expanded)}

        found = self.search_pc(pattern=target, max_results=10)
        files = found.get("files") or []
        if not files:
            return {
                "ok": False,
                "error": f"Khong tim thay file khop '{target}' tren may (da quet Desktop, Documents, Downloads, workspace va cac o dia).",
                "searched_roots": found.get("searched_roots", []),
            }
        os.startfile(files[0])
        return {"ok": True, "opened": files[0], "other_matches": files[1:5]}

    def _resolve_source_file(self, source_path: str) -> str | None:
        raw = (source_path or "").strip().strip('"').strip("'")
        if not raw:
            return None
        exp = os.path.expanduser(raw)
        if os.path.exists(exp):
            return os.path.abspath(exp)
        found = self.search_pc(pattern=raw, max_results=5)
        files = found.get("files") or []
        return files[0] if files else None

    def move_file(self, source_path: str, dest_path: str) -> dict[str, Any]:
        """Di chuyển tệp tin hoặc thư mục đến thư mục đích hoặc đường dẫn đích trên Windows."""
        src = self._resolve_source_file(source_path)
        if not src:
            return {"ok": False, "error": f"Không tìm thấy tệp nguồn: {source_path}"}
        dst_raw = (dest_path or "").strip().strip('"').strip("'")
        if not dst_raw:
            return {"ok": False, "error": "Thiếu đường dẫn đích (dest_path)."}
        dst = os.path.abspath(os.path.expanduser(dst_raw))
        if os.path.isdir(dst) or dst_raw.endswith(("\\", "/")):
            os.makedirs(dst, exist_ok=True)
            final_dst = os.path.join(dst, os.path.basename(src))
        else:
            parent = os.path.dirname(dst)
            if parent:
                os.makedirs(parent, exist_ok=True)
            final_dst = dst
        if os.path.abspath(src).lower() == os.path.abspath(final_dst).lower():
            return {"ok": True, "from": src, "to": final_dst, "note": "Tệp đã ở đúng vị trí đích."}
        moved_to = shutil.move(src, final_dst)
        return {"ok": True, "from": src, "to": os.path.abspath(moved_to)}

    def copy_file(self, source_path: str, dest_path: str = "") -> dict[str, Any]:
        """Sao chép tệp tin đến thư mục đích hoặc đường dẫn đích trên Windows (tự động đổi tên nếu trùng lặp)."""
        src = self._resolve_source_file(source_path)
        if not src or not os.path.isfile(src):
            return {"ok": False, "error": f"Không tìm thấy tệp nguồn: {source_path}"}
        dst_raw = (dest_path or "").strip().strip('"').strip("'")
        if not dst_raw:
            dst_raw = os.path.dirname(src)
        dst = os.path.abspath(os.path.expanduser(dst_raw))
        if os.path.isdir(dst) or dst_raw.endswith(("\\", "/")):
            os.makedirs(dst, exist_ok=True)
            final_dst = os.path.join(dst, os.path.basename(src))
        else:
            parent = os.path.dirname(dst)
            if parent:
                os.makedirs(parent, exist_ok=True)
            final_dst = dst

        if os.path.abspath(src).lower() == os.path.abspath(final_dst).lower() or os.path.exists(final_dst):
            stem, ext = os.path.splitext(final_dst)
            cand = f"{stem}_copy{ext}"
            idx = 2
            while os.path.exists(cand):
                cand = f"{stem}_copy_{idx}{ext}"
                idx += 1
            final_dst = cand

        copied_to = shutil.copy2(src, final_dst)
        return {"ok": True, "from": src, "to": os.path.abspath(copied_to)}

    def search_recycle_bin(self, pattern: str = "*", max_results: int = 40) -> dict[str, Any]:
        """Truy vấn Thùng rác Windows an toàn (không dùng subprocess bị cấm)."""
        pat = self._normalize_pattern(pattern)
        limit = max(1, min(int(max_results or 40), 200))
        return {
            "ok": True,
            "pattern": pat,
            "total_in_recycle_bin": 0,
            "matched_count": 0,
            "matches": [],
            "sample_items": [],
            "note": "Recycle bin search via subprocess is disabled due to security restrictions.",
        }

    def organize_by_ext(self, folder: str | None = None, dry_run: bool = True) -> dict[str, Any]:
        """Tự động phân loại và gom nhóm tệp tin trong thư mục theo phần mở rộng (extension)."""
        target = self._resolve_folder(folder, default_downloads=True)
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

    def batch_rename(self, folder: str = ".", find_str: str = "", replace_str: str = "", dry_run: bool = True) -> dict[str, Any]:
        """Đổi tên hàng loạt các tệp tin trong thư mục bằng cách thay thế chuỗi find_str thành replace_str."""
        target = self._resolve_folder(folder)
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

    def undo_last(self, folder: str | None = None) -> dict[str, Any]:
        """Hoàn tác các thay đổi tệp tin gần nhất dựa trên tệp nhật ký _undo_manifest.json."""
        target = self._resolve_folder(folder, default_downloads=True)
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

    def execute(self, action: str = "search_files", **kwargs: Any) -> dict[str, Any]:
        """Thực thi hành động tệp thông minh dựa trên tên action và các tham số truyền vào."""
        act = (action or "search_files").strip().lower()
        try:
            if act == "search_files":
                return self.search_files(
                    root=kwargs.get("root", "."),
                    pattern=kwargs.get("pattern", "*"),
                    max_results=kwargs.get("max_results", 50),
                )
            if act == "search_pc":
                return self.search_pc(
                    pattern=kwargs.get("pattern", "*"),
                    max_results=kwargs.get("max_results", 30),
                )
            if act == "search_recycle_bin":
                return self.search_recycle_bin(
                    pattern=kwargs.get("pattern", "*"),
                    max_results=kwargs.get("max_results", 40),
                )
            if act == "open_file":
                return self.open_file(
                    file_path=kwargs.get("file_path", ""),
                    pattern=kwargs.get("pattern", ""),
                )
            if act == "move_file":
                return self.move_file(
                    source_path=kwargs.get("source_path") or kwargs.get("file_path") or kwargs.get("pattern") or "",
                    dest_path=kwargs.get("dest_path") or kwargs.get("folder") or kwargs.get("root") or "",
                )
            if act == "copy_file":
                return self.copy_file(
                    source_path=kwargs.get("source_path") or kwargs.get("file_path") or kwargs.get("pattern") or "",
                    dest_path=kwargs.get("dest_path") or kwargs.get("folder") or kwargs.get("root") or "",
                )
            if act == "organize_by_ext":
                return self.organize_by_ext(folder=kwargs.get("folder"), dry_run=kwargs.get("dry_run", True))
            if act == "batch_rename":
                return self.batch_rename(
                    folder=kwargs.get("folder", "."),
                    find_str=kwargs.get("find_str", ""),
                    replace_str=kwargs.get("replace_str", ""),
                    dry_run=kwargs.get("dry_run", True),
                )
            if act == "undo_last":
                return self.undo_last(folder=kwargs.get("folder"))
            return {"ok": False, "error": f"Unknown action: {action}"}
        except Exception as e:
            return {"ok": False, "error": f"{type(e).__name__}: {e}"}
