"""SQLite-backed persistent storage for chat sessions, long-term user facts, and tool cache."""
from __future__ import annotations

import json
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from agent_runtime.config import DATA_DIR

DEFAULT_DB_PATH = DATA_DIR / "agent_memory.db"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class SQLiteMemoryStore:
    """Thread-safe SQLite store for sessions, conversation messages, user facts, and TTL cache."""

    def __init__(self, db_path: Path = DEFAULT_DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_schema()

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(str(self.db_path), timeout=15.0)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA foreign_keys=ON;")
            with conn:
                yield conn
        finally:
            conn.close()

    def _init_schema(self) -> None:
        with self._lock, self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    model TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    model TEXT DEFAULT '',
                    elapsed_sec REAL DEFAULT 0.0,
                    input_tokens INTEGER DEFAULT 0,
                    output_tokens INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id, id);

                CREATE TABLE IF NOT EXISTS user_facts (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    category TEXT DEFAULT 'general',
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS tool_cache (
                    cache_key TEXT PRIMARY KEY,
                    tool_name TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    expires_at REAL NOT NULL,
                    created_at REAL NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_tool_cache_expires ON tool_cache(expires_at);
                """
            )

    # ------------------------------------------------------------------
    # Sessions & Messages
    # ------------------------------------------------------------------
    def create_session(
        self,
        model: str,
        title: str = "",
        session_id: str | None = None,
    ) -> str:
        sid = (session_id or uuid.uuid4().hex[:8]).strip()
        now = _utc_now_iso()
        label = (title or f"Session {sid}").strip()
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO sessions (session_id, title, model, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    model = excluded.model,
                    updated_at = excluded.updated_at
                """,
                (sid, label, model, now, now),
            )
        return sid

    def ensure_session(self, session_id: str, model: str, title: str = "") -> str:
        return self.create_session(model=model, title=title, session_id=session_id)

    def list_sessions(self, limit: int = 20) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                """
                SELECT s.session_id, s.title, s.model, s.created_at, s.updated_at,
                       COUNT(m.id) AS message_count
                FROM sessions s
                LEFT JOIN messages m ON m.session_id = s.session_id
                GROUP BY s.session_id
                ORDER BY s.updated_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    def append_message(
        self,
        session_id: str,
        role: str,
        content: str,
        model: str = "",
        elapsed_sec: float = 0.0,
        input_tokens: int = 0,
        output_tokens: int = 0,
    ) -> None:
        now = _utc_now_iso()
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO messages (session_id, role, content, model, elapsed_sec, input_tokens, output_tokens, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (session_id, role, content, model, elapsed_sec, input_tokens, output_tokens, now),
            )
            # Auto-title session from the first user prompt if still generic
            if role == "user" and content.strip():
                short_title = content.strip().splitlines()[0][:60]
                conn.execute(
                    """
                    UPDATE sessions
                    SET updated_at = ?,
                        model = CASE WHEN ? != '' THEN ? ELSE model END,
                        title = CASE WHEN title LIKE 'Session %' THEN ? ELSE title END
                    WHERE session_id = ?
                    """,
                    (now, model, model, short_title, session_id),
                )
            else:
                conn.execute(
                    "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
                    (now, session_id),
                )

    def get_messages(self, session_id: str, limit: int = 100) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                """
                SELECT role, content, model, elapsed_sec, input_tokens, output_tokens, created_at
                FROM messages
                WHERE session_id = ?
                ORDER BY id ASC
                LIMIT ?
                """,
                (session_id, limit),
            ).fetchall()
        return [dict(r) for r in rows]

    def delete_session(self, session_id: str) -> bool:
        with self._lock, self._connect() as conn:
            cur = conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
            return cur.rowcount > 0

    # ------------------------------------------------------------------
    # Long-term User Facts
    # ------------------------------------------------------------------
    def set_fact(self, key: str, value: str, category: str = "general") -> dict[str, str]:
        k = (key or "").strip()
        v = (value or "").strip()
        cat = (category or "general").strip()
        if not k or not v:
            raise ValueError("key va value khong duoc rong")
        now = _utc_now_iso()
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO user_facts (key, value, category, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    category = excluded.category,
                    updated_at = excluded.updated_at
                """,
                (k, v, cat, now),
            )
        return {"key": k, "value": v, "category": cat, "updated_at": now}

    def get_facts(self, query: str = "") -> list[dict[str, str]]:
        q = (query or "").strip().lower()
        with self._lock, self._connect() as conn:
            if q:
                like = f"%{q}%"
                rows = conn.execute(
                    """
                    SELECT key, value, category, updated_at
                    FROM user_facts
                    WHERE lower(key) LIKE ? OR lower(value) LIKE ? OR lower(category) LIKE ?
                    ORDER BY updated_at DESC
                    """,
                    (like, like, like),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT key, value, category, updated_at FROM user_facts ORDER BY updated_at DESC"
                ).fetchall()
        return [dict(r) for r in rows]

    def delete_fact(self, key: str) -> bool:
        with self._lock, self._connect() as conn:
            cur = conn.execute("DELETE FROM user_facts WHERE key = ?", ((key or "").strip(),))
            return cur.rowcount > 0

    def format_facts_for_prompt(self, max_items: int = 20) -> str:
        facts = self.get_facts()[:max_items]
        if not facts:
            return ""
        lines = [f"- {f['key']} ({f['category']}): {f['value']}" for f in facts]
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # SQLite TTL Cache
    # ------------------------------------------------------------------
    def cache_get(self, cache_key: str) -> dict[str, Any] | None:
        now = time.time()
        with self._lock, self._connect() as conn:
            row = conn.execute(
                "SELECT payload_json, expires_at FROM tool_cache WHERE cache_key = ?",
                (cache_key,),
            ).fetchone()
            if row is None:
                return None
            if float(row["expires_at"]) <= now:
                conn.execute("DELETE FROM tool_cache WHERE cache_key = ?", (cache_key,))
                return None
            try:
                return json.loads(row["payload_json"])
            except json.JSONDecodeError:
                return None

    def cache_set(self, cache_key: str, tool_name: str, payload: dict[str, Any], ttl_sec: int) -> None:
        if ttl_sec <= 0:
            return
        now = time.time()
        raw = json.dumps(payload, ensure_ascii=False, default=str)
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO tool_cache (cache_key, tool_name, payload_json, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(cache_key) DO UPDATE SET
                    payload_json = excluded.payload_json,
                    expires_at = excluded.expires_at,
                    created_at = excluded.created_at
                """,
                (cache_key, tool_name, raw, now + ttl_sec, now),
            )

    def cache_clear(self) -> int:
        with self._lock, self._connect() as conn:
            cur = conn.execute("DELETE FROM tool_cache")
            return cur.rowcount

    def cache_prune_expired(self) -> int:
        now = time.time()
        with self._lock, self._connect() as conn:
            cur = conn.execute("DELETE FROM tool_cache WHERE expires_at <= ?", (now,))
            return cur.rowcount
