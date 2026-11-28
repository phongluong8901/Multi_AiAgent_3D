"""Long-term user memory skill backed by SQLite (data/agent_memory.db)."""
from __future__ import annotations

import sys
from pathlib import Path

_PROJECT_ROOT = str(Path(__file__).resolve().parents[2])
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from agent_runtime.memory_store import SQLiteMemoryStore


class UserMemoryClient:
    """Save, search, and delete long-term user facts and preferences in SQLite."""

    def __init__(self):
        self._store = SQLiteMemoryStore()

    def remember_fact(self, key: str, value: str, category: str = "preference") -> dict:
        """Persist a long-term user fact or preference (e.g. key='default_city', value='Hanoi')."""
        saved = self._store.set_fact(key=key, value=value, category=category)
        return {"status": "saved", "fact": saved}

    def recall_facts(self, query: str = "") -> dict:
        """Retrieve all stored user facts, or filter facts by keyword."""
        facts = self._store.get_facts(query=query)
        return {"count": len(facts), "facts": facts}

    def forget_fact(self, key: str) -> dict:
        """Delete a stored user fact by its exact key."""
        deleted = self._store.delete_fact(key=key)
        return {"key": key, "deleted": deleted}
