import os
import re
from datetime import datetime
from typing import List, Dict, Union

TOOL_SCHEMA = {
    "name": "skill_markdown_note_vault",
    "risk_level": "safe",
    "description": "Manage a local Markdown note vault: create/append daily notes, search notes by text or #tags, and list recent notes. Quản lý ghi chú cá nhân Markdown Obsidian, tạo ghi chú hàng ngày daily note, tìm ghi chú theo tag",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["create_daily_note", "search_notes", "list_recent_notes"]
            },
            "vault_dir": {
                "type": "string",
                "default": "."
            },
            "content": {
                "type": "string",
                "default": ""
            },
            "query": {
                "type": "string",
                "default": ""
            },
            "tag": {
                "type": "string",
                "default": ""
            },
            "limit": {
                "type": "integer",
                "default": 10
            }
        },
        "required": ["action"]
    }
}

def execute(action: str = "", **kwargs) -> Dict[str, Union[bool, str, List[str]]]:
    if action == "create_daily_note":
        return _safe_call(create_daily_note, kwargs)
    elif action == "search_notes":
        return _safe_call(search_notes, kwargs)
    elif action == "list_recent_notes":
        return _safe_call(list_recent_notes, kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def create_daily_note(vault_dir: str = ".", content: str = "", dry_run: bool = True) -> Dict[str, Union[bool, str]]:
    try:
        from pathlib import Path
    except ImportError:
        return {"ok": False, "error": "Missing package pathlib"}
    
    date_str = datetime.now().strftime("%Y-%m-%d")
    file_path = Path(vault_dir) / f"{date_str}.md"
    
    if dry_run:
        return {"ok": True, "preview": f"Would create/append to {file_path} with content: {content}"}
    
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with file_path.open("a", encoding="utf-8") as f:
        f.write(content + "\n")
    
    return {"ok": True, "message": f"Created/updated {file_path}"}

def search_notes(vault_dir: str = ".", query: str = "", tag: str = "", dry_run: bool = True) -> Dict[str, Union[bool, List[str]]]:
    try:
        from pathlib import Path
    except ImportError:
        return {"ok": False, "error": "Missing package pathlib"}
    
    results = []
    for file_path in Path(vault_dir).glob("*.md"):
        with file_path.open("r", encoding="utf-8") as f:
            content = f.read()
            if query and query.lower() in content.lower():
                results.append(str(file_path))
            if tag and re.search(rf"\b{re.escape(tag)}\b", content):
                results.append(str(file_path))
    
    if dry_run:
        return {"ok": True, "preview": results}
    
    return {"ok": True, "results": results}

def list_recent_notes(vault_dir: str = ".", limit: int = 10, dry_run: bool = True) -> Dict[str, Union[bool, List[str]]]:
    try:
        from pathlib import Path
    except ImportError:
        return {"ok": False, "error": "Missing package pathlib"}
    
    notes = sorted(Path(vault_dir).glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)
    recent_notes = [str(note) for note in notes[:limit]]
    
    if dry_run:
        return {"ok": True, "preview": recent_notes}
    
    return {"ok": True, "recent_notes": recent_notes}

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
