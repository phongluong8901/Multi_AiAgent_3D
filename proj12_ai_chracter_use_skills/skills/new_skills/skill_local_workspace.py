"""Sandboxed read-only local workspace inspector (blocks secret files like .env)."""
from __future__ import annotations

import os
from pathlib import Path

_BLOCKED_NAMES = {".env", ".env.local", ".env.production", "id_rsa", "credentials.json"}
_IGNORED_DIRS = {".venv", "__pycache__", ".git", ".pytest_cache", "node_modules"}


class LocalWorkspaceClient:
    """List and read text files inside the local project workspace safely."""

    def __init__(self, root_dir: str | None = None):
        if root_dir:
            self.root = Path(root_dir).resolve()
        else:
            # skills/search_skills/skill_local_workspace.py -> project root
            self.root = Path(__file__).resolve().parents[2]

    def _resolve_safe(self, relative_path: str) -> Path:
        rel = (relative_path or ".").strip()
        target = (self.root / rel).resolve()
        if target != self.root and self.root not in target.parents:
            raise ValueError("Khong duoc truy cap file ben ngoai thu muc du an.")
        if target.name.lower() in _BLOCKED_NAMES or target.name.lower().startswith(".env"):
            raise ValueError(f"Bi chan truy cap file nhay cam: {target.name}")
        return target

    def list_files(self, subdir: str = ".", max_items: int = 50) -> dict:
        """List files and folders inside the project workspace (or a subdirectory like 'outputs')."""
        base = self._resolve_safe(subdir)
        if not base.exists() or not base.is_dir():
            raise FileNotFoundError(f"Khong tim thay thu muc: {subdir}")

        entries: list[dict] = []
        for item in sorted(base.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
            if item.name in _IGNORED_DIRS or item.name.lower().startswith(".env"):
                continue
            entries.append(
                {
                    "name": item.name,
                    "type": "dir" if item.is_dir() else "file",
                    "size_bytes": item.stat().st_size if item.is_file() else 0,
                }
            )
            if len(entries) >= max_items:
                break

        return {
            "directory": str(base.relative_to(self.root)) if base != self.root else ".",
            "count": len(entries),
            "entries": entries,
        }

    def read_text_file(self, relative_path: str, max_chars: int = 6000) -> dict:
        """Read a UTF-8 text/markdown/json/csv/python file inside the project workspace."""
        target = self._resolve_safe(relative_path)
        if not target.exists() or not target.is_file():
            raise FileNotFoundError(f"Khong tim thay file: {relative_path}")

        content = target.read_text(encoding="utf-8", errors="replace")
        return {
            "path": str(target.relative_to(self.root)),
            "total_chars": len(content),
            "truncated": len(content) > max_chars,
            "content": content[:max_chars],
        }
