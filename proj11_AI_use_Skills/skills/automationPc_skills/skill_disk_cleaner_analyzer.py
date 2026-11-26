"""Disk Analyzer & Safe Temp Cleaner: find largest files, detect SHA256 duplicates, preview temp cleanup."""
import hashlib
import os
import tempfile
from collections import defaultdict
from typing import Any

TOOL_SCHEMA: dict[str, Any] = {
    "name": "skill_disk_cleaner_analyzer",
    "description": (
        "Phân tích dung lượng ổ đĩa trên Windows: quét tìm các file nặng nhất chiếm ổ cứng, "
        "tìm file trùng lặp (duplicate) theo mã băm SHA256, và xem trước/dọn rác thư mục Temp an toàn với dry_run. "
        "Disk analyzer: find_large_files, find_duplicates, clean_temp_preview."
    ),
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["find_large_files", "find_duplicates", "clean_temp_preview"]},
            "root": {"type": "string", "description": "Thư mục gốc để quét (mặc định: '.')."},
            "top_n": {"type": "integer", "description": "Số file nặng nhất cần liệt kê (mặc định: 15)."},
            "min_mb": {"type": "number", "description": "Ngưỡng dung lượng tối thiểu theo MB (mặc định: 10.0)."},
            "max_files": {"type": "integer", "description": "Giới hạn số file quét trùng lặp (mặc định: 500)."},
            "temp_dir": {"type": "string", "description": "Thư mục Temp tùy chọn (mặc định: Temp hệ thống)."},
            "dry_run": {"type": "boolean", "description": "True = chỉ xem trước, không xóa file (mặc định: True)."},
        },
        "required": ["action"],
    },
}


def find_large_files(root: str = ".", top_n: int = 15, min_mb: float = 10.0) -> dict[str, Any]:
    base = os.path.expanduser(root or ".")
    if not os.path.isdir(base):
        return {"ok": False, "error": f"Directory not found: {base}"}
    min_bytes = int(float(min_mb or 0) * 1024 * 1024)
    found = []
    for dp, _, fns in os.walk(base):
        for fn in fns:
            fp = os.path.join(dp, fn)
            try:
                sz = os.path.getsize(fp)
                if sz >= min_bytes:
                    found.append({"path": fp, "size_mb": round(sz / (1024**2), 2), "size_bytes": sz})
            except OSError:
                continue
    found.sort(key=lambda x: x["size_bytes"], reverse=True)
    return {"ok": True, "root": os.path.abspath(base), "count": len(found), "largest_files": found[: max(1, int(top_n or 15))]}


def _sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def find_duplicates(root: str = ".", max_files: int = 500) -> dict[str, Any]:
    base = os.path.expanduser(root or ".")
    if not os.path.isdir(base):
        return {"ok": False, "error": f"Directory not found: {base}"}
    by_size: dict[int, list[str]] = defaultdict(list)
    scanned = 0
    for dp, _, fns in os.walk(base):
        for fn in fns:
            if scanned >= int(max_files or 500):
                break
            fp = os.path.join(dp, fn)
            try:
                sz = os.path.getsize(fp)
                if sz > 0:
                    by_size[sz].append(fp)
                    scanned += 1
            except OSError:
                continue

    dup_groups = []
    wasted_bytes = 0
    for sz, paths in by_size.items():
        if len(paths) < 2:
            continue
        by_hash: dict[str, list[str]] = defaultdict(list)
        for p in paths:
            try:
                by_hash[_sha256_file(p)].append(p)
            except OSError:
                continue
        for digest, gpaths in by_hash.items():
            if len(gpaths) > 1:
                wasted_bytes += sz * (len(gpaths) - 1)
                dup_groups.append({"sha256": digest[:16], "size_bytes": sz, "files": gpaths})
    return {"ok": True, "scanned_files": scanned, "duplicate_groups": dup_groups[:30], "wasted_mb": round(wasted_bytes / (1024**2), 2)}


def clean_temp_preview(temp_dir: str = "", dry_run: bool = True) -> dict[str, Any]:
    target = os.path.expanduser(temp_dir) if temp_dir else tempfile.gettempdir()
    if not os.path.isdir(target):
        return {"ok": False, "error": f"Temp directory not found: {target}"}
    items = []
    total_bytes = 0
    deleted = 0
    for entry in os.listdir(target):
        fp = os.path.join(target, entry)
        if os.path.isfile(fp):
            try:
                sz = os.path.getsize(fp)
                total_bytes += sz
                items.append({"path": fp, "size_kb": round(sz / 1024.0, 1)})
                if not dry_run:
                    os.remove(fp)
                    deleted += 1
            except OSError:
                continue
    return {"ok": True, "temp_dir": target, "dry_run": bool(dry_run), "candidates": len(items), "reclaimable_mb": round(total_bytes / (1024**2), 2), "deleted": deleted, "sample": items[:25]}


def execute(action: str = "find_large_files", **kwargs: Any) -> dict[str, Any]:
    act = (action or "find_large_files").strip().lower()
    try:
        if act == "find_large_files":
            return find_large_files(kwargs.get("root", "."), kwargs.get("top_n", 15), kwargs.get("min_mb", 10.0))
        if act == "find_duplicates":
            return find_duplicates(kwargs.get("root", "."), kwargs.get("max_files", 500))
        if act == "clean_temp_preview":
            return clean_temp_preview(kwargs.get("temp_dir", ""), kwargs.get("dry_run", True))
        return {"ok": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
