"""SQLite-backed persistent storage for chat sessions, long-term user facts, and tool cache."""
from __future__ import annotations

import json
import math
import re
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator

from agent_runtime.config import DATA_DIR

DEFAULT_DB_PATH = DATA_DIR / "agent_memory.db"

_CORE_PROFILE_KEYS = frozenset({"user_name", "user_role", "default_city", "work_tech_stack"})
_PERSONA_INTERNAL_KEYS = frozenset({"persona_preset", "persona_custom_prompt"})


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _days_since_iso(iso_str: str) -> float:
    if not iso_str:
        return 0.0
    try:
        dt = datetime.fromisoformat(iso_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        delta = (datetime.now(timezone.utc) - dt).total_seconds() / 86400.0
        return max(0.0, delta)
    except Exception:
        return 0.0


def _compute_decay_score(
    importance: float,
    last_accessed_iso: str,
    access_count: int,
    decay_lambda: float = 0.03,
) -> float:
    """Compute effective retrieval priority with exponential time decay and access reinforcement."""
    days = _days_since_iso(last_accessed_iso)
    imp = max(0.1, float(importance or 1.0))
    cnt = max(0, int(access_count or 0))
    return round(imp * math.exp(-decay_lambda * days) + 0.15 * math.log1p(cnt), 4)


def _normalize_error_signature(error_text: str) -> str:
    txt = (error_text or "").strip().splitlines()[0] if error_text else ""
    txt = re.sub(r"0x[0-9a-fA-F]+", "0xHEX", txt)
    txt = re.sub(r"\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}\S*", "<TS>", txt)
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt[:140] or "unknown_error"


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

                CREATE TABLE IF NOT EXISTS tool_metrics (
                    tool_name TEXT PRIMARY KEY,
                    calls INTEGER NOT NULL DEFAULT 0,
                    successes INTEGER NOT NULL DEFAULT 0,
                    failures INTEGER NOT NULL DEFAULT 0,
                    avg_ms REAL NOT NULL DEFAULT 0.0,
                    consecutive_failures INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT DEFAULT '',
                    last_used_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS tool_playbooks (
                    playbook_id TEXT PRIMARY KEY,
                    trigger_keywords TEXT NOT NULL,
                    tools_csv TEXT NOT NULL,
                    strategy_hint TEXT NOT NULL,
                    success_count INTEGER NOT NULL DEFAULT 1,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS tool_embeddings (
                    tool_name TEXT PRIMARY KEY,
                    text_hash TEXT NOT NULL,
                    vector_json TEXT NOT NULL,
                    model TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS user_rules (
                    rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    rule_text TEXT NOT NULL UNIQUE,
                    source TEXT DEFAULT 'manual',
                    active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS pending_facts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT NOT NULL UNIQUE,
                    value TEXT NOT NULL,
                    category TEXT DEFAULT 'auto_learned',
                    evidence TEXT DEFAULT '',
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS feedback_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT DEFAULT '',
                    prompt_preview TEXT DEFAULT '',
                    correction_text TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS user_fact_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    fact_key TEXT NOT NULL,
                    old_value TEXT NOT NULL,
                    new_value TEXT NOT NULL,
                    category TEXT DEFAULT 'general',
                    valid_from TEXT NOT NULL,
                    valid_to TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'deprecated',
                    reason TEXT DEFAULT 'conflict_update'
                );

                CREATE INDEX IF NOT EXISTS idx_fact_history_key ON user_fact_history(fact_key, id DESC);

                CREATE TABLE IF NOT EXISTS tool_antipatterns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tool_name TEXT NOT NULL,
                    error_signature TEXT NOT NULL,
                    failed_args_summary TEXT DEFAULT '',
                    lesson_learned TEXT NOT NULL,
                    hit_count INTEGER NOT NULL DEFAULT 1,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL,
                    last_seen_at TEXT NOT NULL,
                    UNIQUE(tool_name, error_signature)
                );

                CREATE INDEX IF NOT EXISTS idx_antipatterns_tool ON tool_antipatterns(tool_name, status);

                CREATE TABLE IF NOT EXISTS episodic_tool_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT DEFAULT '',
                    tool_name TEXT NOT NULL,
                    args_json TEXT DEFAULT '{}',
                    ok INTEGER NOT NULL,
                    elapsed_ms INTEGER NOT NULL DEFAULT 0,
                    error_text TEXT DEFAULT '',
                    output_snippet TEXT DEFAULT '',
                    consolidated INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_episodic_created ON episodic_tool_logs(created_at);
                CREATE INDEX IF NOT EXISTS idx_episodic_consolidated ON episodic_tool_logs(consolidated, id);

                CREATE TABLE IF NOT EXISTS prospective_tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    trigger_condition TEXT DEFAULT 'session_start',
                    due_date TEXT DEFAULT '',
                    priority TEXT DEFAULT 'normal',
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TEXT NOT NULL,
                    completed_at TEXT DEFAULT ''
                );

                CREATE INDEX IF NOT EXISTS idx_prospective_status ON prospective_tasks(status, due_date);

                CREATE TABLE IF NOT EXISTS memory_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """
            )
            self._migrate_schema(conn)
        self._seed_default_playbooks()
        self._seed_default_profile()

    @staticmethod
    def utc_now_iso() -> str:
        return _utc_now_iso()

    def _migrate_schema(self, conn: sqlite3.Connection) -> None:
        """Non-destructive Memory OS column migrations for existing SQLite databases."""
        now = _utc_now_iso()
        fact_cols = {r["name"] for r in conn.execute("PRAGMA table_info(user_facts)").fetchall()}
        fact_additions = [
            ("confidence", "REAL NOT NULL DEFAULT 1.0"),
            ("importance_score", "REAL NOT NULL DEFAULT 1.0"),
            ("access_count", "INTEGER NOT NULL DEFAULT 0"),
            ("last_accessed", f"TEXT NOT NULL DEFAULT '{now}'"),
            ("valid_from", f"TEXT NOT NULL DEFAULT '{now}'"),
            ("status", "TEXT NOT NULL DEFAULT 'active'"),
        ]
        for col, ddl in fact_additions:
            if col not in fact_cols:
                conn.execute(f"ALTER TABLE user_facts ADD COLUMN {col} {ddl}")

        rule_cols = {r["name"] for r in conn.execute("PRAGMA table_info(user_rules)").fetchall()}
        rule_additions = [
            ("importance_score", "REAL NOT NULL DEFAULT 1.2"),
            ("access_count", "INTEGER NOT NULL DEFAULT 0"),
            ("last_accessed", f"TEXT NOT NULL DEFAULT '{now}'"),
            ("valid_from", f"TEXT NOT NULL DEFAULT '{now}'"),
            ("valid_to", "TEXT NOT NULL DEFAULT ''"),
            ("status", "TEXT NOT NULL DEFAULT 'active'"),
        ]
        for col, ddl in rule_additions:
            if col not in rule_cols:
                conn.execute(f"ALTER TABLE user_rules ADD COLUMN {col} {ddl}")

    def get_meta(self, key: str, default: str = "") -> str:
        with self._lock, self._connect() as conn:
            row = conn.execute("SELECT value FROM memory_meta WHERE key = ?", (key,)).fetchone()
            return str(row["value"]) if row else default

    def set_meta(self, key: str, value: str) -> None:
        now = _utc_now_iso()
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO memory_meta (key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                """,
                (key, value, now),
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
    # Long-term User Facts (Semantic Memory + Conflict Resolution + Decay)
    # ------------------------------------------------------------------
    def set_fact(
        self,
        key: str,
        value: str,
        category: str = "general",
        *,
        importance_score: float | None = None,
        confidence: float = 1.0,
        reason: str = "conflict_update",
    ) -> dict[str, Any]:
        k = (key or "").strip()
        v = (value or "").strip()
        cat = (category or "general").strip()
        if not k or not v:
            raise ValueError("key va value khong duoc rong")
        now = _utc_now_iso()
        imp = float(importance_score) if importance_score is not None else (2.0 if k in _CORE_PROFILE_KEYS else 1.0)
        conf = max(0.1, min(1.0, float(confidence)))

        with self._lock, self._connect() as conn:
            existing = conn.execute(
                "SELECT value, category, valid_from, updated_at, importance_score FROM user_facts WHERE key = ?",
                (k,),
            ).fetchone()
            # Conflict Resolution: archive previous value with valid_to instead of blind overwrite
            if existing is not None and str(existing["value"]).strip() != v:
                conn.execute(
                    """
                    INSERT INTO user_fact_history (fact_key, old_value, new_value, category, valid_from, valid_to, status, reason)
                    VALUES (?, ?, ?, ?, ?, ?, 'deprecated', ?)
                    """,
                    (
                        k,
                        str(existing["value"]),
                        v,
                        str(existing["category"] or cat),
                        str(existing["valid_from"] or existing["updated_at"] or now),
                        now,
                        reason,
                    ),
                )
            conn.execute(
                """
                INSERT INTO user_facts (key, value, category, updated_at, confidence, importance_score, access_count, last_accessed, valid_from, status)
                VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'active')
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    category = excluded.category,
                    updated_at = excluded.updated_at,
                    confidence = excluded.confidence,
                    importance_score = excluded.importance_score,
                    last_accessed = excluded.last_accessed,
                    valid_from = CASE WHEN user_facts.value != excluded.value THEN excluded.valid_from ELSE user_facts.valid_from END,
                    status = 'active'
                """,
                (k, v, cat, now, conf, imp, now, now),
            )
        return {
            "key": k,
            "value": v,
            "category": cat,
            "updated_at": now,
            "valid_from": now,
            "importance_score": imp,
            "confidence": conf,
            "status": "active",
        }

    def get_facts(self, query: str = "", include_internal: bool = True) -> list[dict[str, Any]]:
        q = (query or "").strip().lower()
        with self._lock, self._connect() as conn:
            if q:
                like = f"%{q}%"
                rows = conn.execute(
                    """
                    SELECT key, value, category, updated_at, confidence, importance_score,
                           access_count, last_accessed, valid_from, status
                    FROM user_facts
                    WHERE status = 'active'
                      AND (lower(key) LIKE ? OR lower(value) LIKE ? OR lower(category) LIKE ?)
                    ORDER BY updated_at DESC
                    """,
                    (like, like, like),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT key, value, category, updated_at, confidence, importance_score,
                           access_count, last_accessed, valid_from, status
                    FROM user_facts
                    WHERE status = 'active'
                    ORDER BY updated_at DESC
                    """
                ).fetchall()
        out: list[dict[str, Any]] = []
        for r in rows:
            item = dict(r)
            if not include_internal and item["key"] in _PERSONA_INTERNAL_KEYS:
                continue
            item["effective_score"] = _compute_decay_score(
                importance=float(item.get("importance_score") or 1.0),
                last_accessed_iso=str(item.get("last_accessed") or item.get("updated_at") or ""),
                access_count=int(item.get("access_count") or 0),
            )
            out.append(item)
        out.sort(key=lambda x: x["effective_score"], reverse=True)
        return out

    def get_fact_history(self, limit: int = 30) -> list[dict[str, Any]]:
        """Return deprecated/superseded versions of user_facts for Conflict Resolution audit UI."""
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, fact_key, old_value, new_value, category, valid_from, valid_to, status, reason
                FROM user_fact_history
                ORDER BY id DESC
                LIMIT ?
                """,
                (int(limit),),
            ).fetchall()
        return [dict(r) for r in rows]

    def delete_fact(self, key: str) -> bool:
        k = (key or "").strip()
        now = _utc_now_iso()
        with self._lock, self._connect() as conn:
            existing = conn.execute(
                "SELECT value, category, valid_from, updated_at FROM user_facts WHERE key = ?",
                (k,),
            ).fetchone()
            if existing is not None:
                conn.execute(
                    """
                    INSERT INTO user_fact_history (fact_key, old_value, new_value, category, valid_from, valid_to, status, reason)
                    VALUES (?, ?, '', ?, ?, ?, 'deprecated', 'deleted')
                    """,
                    (
                        k,
                        str(existing["value"]),
                        str(existing["category"] or "general"),
                        str(existing["valid_from"] or existing["updated_at"] or now),
                        now,
                    ),
                )
            cur = conn.execute("DELETE FROM user_facts WHERE key = ?", (k,))
            return cur.rowcount > 0

    def format_facts_for_prompt(self, max_items: int = 18) -> str:
        facts = self.get_facts(include_internal=False)[:max_items]
        if not facts:
            return ""
        now = _utc_now_iso()
        selected_keys = [f["key"] for f in facts]
        try:
            with self._lock, self._connect() as conn:
                conn.executemany(
                    "UPDATE user_facts SET access_count = access_count + 1, last_accessed = ? WHERE key = ?",
                    [(now, k) for k in selected_keys],
                )
        except Exception:
            pass
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

    # ------------------------------------------------------------------
    # Adaptive Tool Metrics & Experiential Playbooks
    # ------------------------------------------------------------------
    def _seed_default_playbooks(self) -> None:
        defaults = [
            (
                "crypto_to_fiat",
                "btc,eth,bitcoin,crypto,vnd,usd,ty gia,ti gia,doi ra,quy doi",
                "binance_crypto_client__get_crypto_price,frankfurter_forex_client__get_exchange_rate,calculator__evaluate",
                "Goi song song binance + frankfurter_forex lay gia va ty gia, sau do dung calculator__evaluate nhan chinh xac.",
            ),
            (
                "weather_forecast_next_days",
                "ngay mai,tuan toi,du bao,thoi tiet,nhiet do",
                "datetime_client__get_current_time,open_meteo_weather_client__get_current_weather,web_search__search",
                "Lay ngay hien tai bang datetime_client; open_meteo chi co nhiet do hien tai nen dung web_search kem ngay cu the cho du bao ngay mai.",
            ),
            (
                "arxiv_pdf_summary",
                "arxiv,pdf,bai bao,paper,tom tat",
                "arxiv_api_client__search_papers,document_analyzer__read_pdf",
                "Tim bai bao qua arxiv_api_client truoc, sau do doc noi dung PDF qua document_analyzer__read_pdf.",
            ),
            (
                "coords_and_weather",
                "toa do,kinh do,vi do,thoi tiet",
                "openstreetmap_api_client__get_coordinates,open_meteo_weather_client__get_current_weather",
                "Goi song song openstreetmap_api_client__get_coordinates va open_meteo_weather_client__get_current_weather.",
            ),
            (
                "data_to_report",
                "xuat,export,luu file,bao cao,excel,xlsx,csv,markdown",
                "report_exporter__export_xlsx,report_exporter__export_markdown,report_exporter__export_csv",
                "Lay du lieu that tu tool chuyen biet truoc, sau do goi report_exporter luu vao thu muc outputs/.",
            ),
        ]
        now = _utc_now_iso()
        with self._lock, self._connect() as conn:
            count = conn.execute("SELECT COUNT(*) FROM tool_playbooks").fetchone()[0]
            if count == 0:
                conn.executemany(
                    """
                    INSERT INTO tool_playbooks (playbook_id, trigger_keywords, tools_csv, strategy_hint, success_count, updated_at)
                    VALUES (?, ?, ?, ?, 1, ?)
                    """,
                    [(pid, kw, tcsv, hint, now) for pid, kw, tcsv, hint in defaults],
                )

    def record_tool_execution(
        self,
        tool_name: str,
        ok: bool,
        elapsed_ms: int,
        error: str = "",
    ) -> None:
        """Update running telemetry (success rate, EMA latency, consecutive failures) for a tool."""
        now = _utc_now_iso()
        with self._lock, self._connect() as conn:
            row = conn.execute(
                "SELECT calls, successes, failures, avg_ms, consecutive_failures FROM tool_metrics WHERE tool_name = ?",
                (tool_name,),
            ).fetchone()
            if row is None:
                calls = 1
                succ = 1 if ok else 0
                fail = 0 if ok else 1
                avg_ms = float(elapsed_ms)
                consec_fail = 0 if ok else 1
            else:
                calls = int(row["calls"]) + 1
                succ = int(row["successes"]) + (1 if ok else 0)
                fail = int(row["failures"]) + (0 if ok else 1)
                prev_avg = float(row["avg_ms"])
                # Exponential moving average favors recent real-world latency
                avg_ms = round(0.7 * prev_avg + 0.3 * float(elapsed_ms), 1)
                consec_fail = 0 if ok else (int(row["consecutive_failures"]) + 1)

            conn.execute(
                """
                INSERT INTO tool_metrics (tool_name, calls, successes, failures, avg_ms, consecutive_failures, last_error, last_used_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(tool_name) DO UPDATE SET
                    calls = excluded.calls,
                    successes = excluded.successes,
                    failures = excluded.failures,
                    avg_ms = excluded.avg_ms,
                    consecutive_failures = excluded.consecutive_failures,
                    last_error = excluded.last_error,
                    last_used_at = excluded.last_used_at
                """,
                (tool_name, calls, succ, fail, avg_ms, consec_fail, (error or "")[:160], now),
            )

    def get_tool_metrics_map(self) -> dict[str, dict[str, Any]]:
        with self._lock, self._connect() as conn:
            rows = conn.execute("SELECT * FROM tool_metrics ORDER BY calls DESC, tool_name ASC").fetchall()
        return {str(r["tool_name"]): dict(r) for r in rows}

    def list_playbooks(self) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM tool_playbooks ORDER BY success_count DESC, updated_at DESC"
            ).fetchall()
        return [dict(r) for r in rows]

    def record_successful_workflow(self, prompt_keywords: list[str], ordered_tools: list[str]) -> None:
        """Auto-learn or reinforce multi-tool cooperation patterns from real successful turns."""
        distinct: list[str] = []
        for t in ordered_tools:
            if t and t not in distinct:
                distinct.append(t)
        if len(distinct) < 2 or len(distinct) > 4:
            return

        tools_csv = ",".join(distinct)
        pid = "auto_" + "__".join(t.split("__")[0] for t in distinct)[:64]
        now = _utc_now_iso()
        kw_str = ",".join(prompt_keywords[:8])
        hint = f"Mau phoi hop hieu qua da kiem chung: {' -> '.join(distinct)}."

        with self._lock, self._connect() as conn:
            existing = conn.execute(
                "SELECT playbook_id, success_count FROM tool_playbooks WHERE tools_csv = ?",
                (tools_csv,),
            ).fetchone()
            if existing is not None:
                conn.execute(
                    "UPDATE tool_playbooks SET success_count = success_count + 1, updated_at = ? WHERE playbook_id = ?",
                    (now, existing["playbook_id"]),
                )
            elif kw_str:
                conn.execute(
                    """
                    INSERT INTO tool_playbooks (playbook_id, trigger_keywords, tools_csv, strategy_hint, success_count, updated_at)
                    VALUES (?, ?, ?, ?, 1, ?)
                    ON CONFLICT(playbook_id) DO UPDATE SET
                        success_count = tool_playbooks.success_count + 1,
                        updated_at = excluded.updated_at
                    """,
                    (pid, kw_str, tools_csv, hint, now),
                )

    # ------------------------------------------------------------------
    # Tool Embeddings Cache (SQLite Vector Store for Hybrid Router)
    # ------------------------------------------------------------------
    def get_tool_embeddings_map(self) -> dict[str, tuple[str, list[float]]]:
        with self._lock, self._connect() as conn:
            rows = conn.execute("SELECT tool_name, text_hash, vector_json FROM tool_embeddings").fetchall()
        out: dict[str, tuple[str, list[float]]] = {}
        for r in rows:
            try:
                out[str(r["tool_name"])] = (str(r["text_hash"]), json.loads(r["vector_json"]))
            except Exception:
                continue
        return out

    def upsert_tool_embedding(self, tool_name: str, text_hash: str, vector: list[float], model: str) -> None:
        now = _utc_now_iso()
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO tool_embeddings (tool_name, text_hash, vector_json, model, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(tool_name) DO UPDATE SET
                    text_hash = excluded.text_hash,
                    vector_json = excluded.vector_json,
                    model = excluded.model,
                    updated_at = excluded.updated_at
                """,
                (tool_name, text_hash, json.dumps(vector), model, now),
            )

    # ------------------------------------------------------------------
    # Personalization: User Rules, Pending Auto-Learned Facts & Feedback
    # ------------------------------------------------------------------
    def add_rule(self, rule_text: str, source: str = "manual", importance_score: float = 1.2) -> dict[str, Any]:
        txt = (rule_text or "").strip()
        if not txt:
            raise ValueError("Noi dung quy tac khong duoc rong")
        now = _utc_now_iso()
        imp = max(0.5, float(importance_score))
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO user_rules (rule_text, source, active, created_at, importance_score, access_count, last_accessed, valid_from, valid_to, status)
                VALUES (?, ?, 1, ?, ?, 0, ?, ?, '', 'active')
                ON CONFLICT(rule_text) DO UPDATE SET
                    active = 1,
                    source = excluded.source,
                    importance_score = excluded.importance_score,
                    last_accessed = excluded.last_accessed,
                    valid_to = '',
                    status = 'active'
                """,
                (txt, source, now, imp, now, now),
            )
            row = conn.execute("SELECT * FROM user_rules WHERE rule_text = ?", (txt,)).fetchone()
        return dict(row)

    def list_rules(self, active_only: bool = False) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            if active_only:
                rows = conn.execute("SELECT * FROM user_rules WHERE active = 1 ORDER BY rule_id DESC").fetchall()
            else:
                rows = conn.execute("SELECT * FROM user_rules ORDER BY active DESC, rule_id DESC").fetchall()
        out: list[dict[str, Any]] = []
        for r in rows:
            item = dict(r)
            item["effective_score"] = _compute_decay_score(
                importance=float(item.get("importance_score") or 1.2),
                last_accessed_iso=str(item.get("last_accessed") or item.get("created_at") or ""),
                access_count=int(item.get("access_count") or 0),
            )
            out.append(item)
        if active_only:
            out.sort(key=lambda x: x["effective_score"], reverse=True)
        return out

    def toggle_rule(self, rule_id: int, active: bool) -> bool:
        now = _utc_now_iso()
        with self._lock, self._connect() as conn:
            cur = conn.execute(
                """
                UPDATE user_rules
                SET active = ?,
                    status = ?,
                    valid_to = CASE WHEN ? = 0 THEN ? ELSE '' END
                WHERE rule_id = ?
                """,
                (1 if active else 0, "active" if active else "deprecated", 1 if active else 0, now, int(rule_id)),
            )
            return cur.rowcount > 0

    def delete_rule(self, rule_id: int) -> bool:
        with self._lock, self._connect() as conn:
            cur = conn.execute("DELETE FROM user_rules WHERE rule_id = ?", (int(rule_id),))
            return cur.rowcount > 0

    def format_rules_for_prompt(self, max_items: int = 15) -> str:
        rules = self.list_rules(active_only=True)[:max_items]
        if not rules:
            return ""
        now = _utc_now_iso()
        try:
            with self._lock, self._connect() as conn:
                conn.executemany(
                    "UPDATE user_rules SET access_count = access_count + 1, last_accessed = ? WHERE rule_id = ?",
                    [(now, int(r["rule_id"])) for r in rules],
                )
        except Exception:
            pass
        return "\n".join(f"- {r['rule_text']}" for r in rules)

    def add_pending_fact(self, key: str, value: str, category: str = "auto_learned", evidence: str = "") -> bool:
        k = (key or "").strip()
        v = (value or "").strip()
        if not k or not v:
            return False
        # Skip if already stored in active user_facts with the exact same value
        existing = {f["key"]: f["value"] for f in self.get_facts()}
        if existing.get(k, "").strip().lower() == v.lower():
            return False
        now = _utc_now_iso()
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO pending_facts (key, value, category, evidence, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    category = excluded.category,
                    evidence = excluded.evidence,
                    created_at = excluded.created_at
                """,
                (k, v, category, (evidence or "")[:160], now),
            )
        return True

    def list_pending_facts(self) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            rows = conn.execute("SELECT * FROM pending_facts ORDER BY id DESC").fetchall()
        return [dict(r) for r in rows]

    def approve_pending_fact(self, pending_id: int) -> dict[str, Any] | None:
        with self._lock, self._connect() as conn:
            row = conn.execute("SELECT * FROM pending_facts WHERE id = ?", (int(pending_id),)).fetchone()
            if row is None:
                return None
            item = dict(row)
            conn.execute("DELETE FROM pending_facts WHERE id = ?", (int(pending_id),))

        if item.get("category") == "rule":
            return {"type": "rule", "item": self.add_rule(item["value"], source="auto_learned")}
        return {"type": "fact", "item": self.set_fact(item["key"], item["value"], item.get("category") or "profile")}

    def dismiss_pending_fact(self, pending_id: int) -> bool:
        with self._lock, self._connect() as conn:
            cur = conn.execute("DELETE FROM pending_facts WHERE id = ?", (int(pending_id),))
            return cur.rowcount > 0

    def record_feedback(
        self,
        *,
        session_id: str,
        prompt_preview: str,
        correction_text: str,
        save_as_rule: bool = True,
    ) -> dict[str, Any]:
        corr = (correction_text or "").strip()
        if not corr:
            raise ValueError("Noi dung gop y khong duoc rong")
        now = _utc_now_iso()
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO feedback_log (session_id, prompt_preview, correction_text, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (session_id, (prompt_preview or "")[:200], corr, now),
            )
        rule = self.add_rule(corr, source="feedback") if save_as_rule else None
        return {"ok": True, "rule": rule}

    # ------------------------------------------------------------------
    # Default User Profile & Persona Settings
    # ------------------------------------------------------------------
    def _seed_default_profile(self) -> None:
        defaults = [
            ("user_name", "Phong", "profile"),
            ("user_role", "DEV", "profile"),
            ("default_city", "Hà Nội", "location"),
            ("persona_preset", "expert", "persona"),
            ("persona_custom_prompt", "", "persona"),
        ]
        now = _utc_now_iso()
        with self._lock, self._connect() as conn:
            for k, v, cat in defaults:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO user_facts (key, value, category, updated_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (k, v, cat, now),
                )

    def get_persona_config(self) -> dict[str, str]:
        from agent_runtime.config import PERSONA_PRESETS

        facts = {f["key"]: f["value"] for f in self.get_facts()}
        preset = facts.get("persona_preset", "expert")
        if preset not in PERSONA_PRESETS:
            preset = "expert"
        custom_prompt = facts.get("persona_custom_prompt", "")
        effective = custom_prompt.strip() if preset == "custom" and custom_prompt.strip() else PERSONA_PRESETS[preset]["prompt"]
        return {
            "user_name": facts.get("user_name", "Phong"),
            "user_role": facts.get("user_role", "DEV"),
            "default_city": facts.get("default_city", "Hà Nội"),
            "work_tech_stack": facts.get("work_tech_stack", ""),
            "persona_preset": preset,
            "persona_custom_prompt": custom_prompt,
            "effective_persona_prompt": effective,
        }

    def save_persona_config(
        self,
        *,
        user_name: str,
        user_role: str,
        default_city: str,
        work_tech_stack: str = "",
        persona_preset: str = "expert",
        persona_custom_prompt: str = "",
    ) -> dict[str, str]:
        now = _utc_now_iso()
        pairs = [
            ("user_name", user_name.strip() or "Phong", "profile"),
            ("user_role", user_role.strip() or "DEV", "profile"),
            ("default_city", default_city.strip() or "Hà Nội", "location"),
            ("persona_preset", persona_preset.strip() or "expert", "persona"),
            ("persona_custom_prompt", persona_custom_prompt.strip(), "persona"),
        ]
        if work_tech_stack.strip():
            pairs.append(("work_tech_stack", work_tech_stack.strip(), "work"))
        for k, v, cat in pairs:
            if k in _PERSONA_INTERNAL_KEYS:
                with self._lock, self._connect() as conn:
                    conn.execute(
                        """
                        INSERT INTO user_facts (key, value, category, updated_at, valid_from, last_accessed, status)
                        VALUES (?, ?, ?, ?, ?, ?, 'active')
                        ON CONFLICT(key) DO UPDATE SET
                            value = excluded.value,
                            category = excluded.category,
                            updated_at = excluded.updated_at,
                            last_accessed = excluded.last_accessed
                        """,
                        (k, v, cat, now, now, now),
                    )
            else:
                self.set_fact(k, v, cat, importance_score=2.0, reason="profile_update")
        return self.get_persona_config()

    # ------------------------------------------------------------------
    # Failure / Anti-Pattern Memory (Selective Injection by Routed Tools)
    # ------------------------------------------------------------------
    def record_tool_antipattern(
        self,
        *,
        tool_name: str,
        error_text: str,
        args_dict: dict[str, Any] | None = None,
        lesson_learned: str = "",
    ) -> dict[str, Any]:
        tn = (tool_name or "").strip()
        if not tn:
            return {}
        sig = _normalize_error_signature(error_text)
        args_summary = ""
        if args_dict:
            try:
                args_summary = json.dumps(args_dict, ensure_ascii=False, default=str)[:140]
            except Exception:
                args_summary = str(args_dict)[:140]
        lesson = (lesson_learned or "").strip()
        if not lesson:
            if args_summary and args_summary != "{}":
                lesson = f"Can than khi goi {tn} voi {args_summary} (tung gap loi: {sig[:100]})."
            else:
                lesson = f"Luu y khi goi {tn}: tung gap loi '{sig[:110]}' -> kiem tra tham so hoac chon backup tool."
        now = _utc_now_iso()
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO tool_antipatterns (tool_name, error_signature, failed_args_summary, lesson_learned, hit_count, status, created_at, last_seen_at)
                VALUES (?, ?, ?, ?, 1, 'active', ?, ?)
                ON CONFLICT(tool_name, error_signature) DO UPDATE SET
                    hit_count = tool_antipatterns.hit_count + 1,
                    failed_args_summary = CASE WHEN excluded.failed_args_summary != '' THEN excluded.failed_args_summary ELSE tool_antipatterns.failed_args_summary END,
                    lesson_learned = CASE WHEN ? != '' THEN excluded.lesson_learned ELSE tool_antipatterns.lesson_learned END,
                    status = 'active',
                    last_seen_at = excluded.last_seen_at
                """,
                (tn, sig, args_summary, lesson, now, now, (lesson_learned or "").strip()),
            )
            row = conn.execute(
                "SELECT * FROM tool_antipatterns WHERE tool_name = ? AND error_signature = ?",
                (tn, sig),
            ).fetchone()
        return dict(row) if row else {}

    def get_antipatterns_for_tools(self, tool_names: list[str], limit_per_tool: int = 2) -> list[dict[str, Any]]:
        clean = [t.strip() for t in (tool_names or []) if t and t.strip()]
        if not clean:
            return []
        placeholders = ",".join("?" for _ in clean)
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                f"""
                SELECT * FROM tool_antipatterns
                WHERE status = 'active' AND tool_name IN ({placeholders})
                ORDER BY hit_count DESC, last_seen_at DESC
                """,
                clean,
            ).fetchall()
        per_tool: dict[str, int] = {}
        selected: list[dict[str, Any]] = []
        for r in rows:
            item = dict(r)
            tn = item["tool_name"]
            if per_tool.get(tn, 0) < limit_per_tool:
                per_tool[tn] = per_tool.get(tn, 0) + 1
                selected.append(item)
        return selected

    def format_antipatterns_for_prompt(self, tool_names: list[str], limit_per_tool: int = 2) -> str:
        items = self.get_antipatterns_for_tools(tool_names, limit_per_tool=limit_per_tool)
        if not items:
            return ""
        return "\n".join(
            f"- [{it['tool_name']}] (da gap {it['hit_count']} lan): {it['lesson_learned']}"
            for it in items
        )

    def list_antipatterns(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM tool_antipatterns WHERE status = 'active' ORDER BY hit_count DESC, last_seen_at DESC LIMIT ?",
                (int(limit),),
            ).fetchall()
        return [dict(r) for r in rows]

    def delete_antipattern(self, ap_id: int) -> bool:
        with self._lock, self._connect() as conn:
            cur = conn.execute("DELETE FROM tool_antipatterns WHERE id = ?", (int(ap_id),))
            return cur.rowcount > 0

    def reset_tool_health(self, tool_names: list[str]) -> int:
        """Clear stale anti-patterns and consecutive_failures when a skill is fixed/upgraded via Hot-Reload."""
        clean = [t.strip() for t in (tool_names or []) if t and t.strip()]
        if not clean:
            return 0
        placeholders = ",".join("?" for _ in clean)
        with self._lock, self._connect() as conn:
            cur = conn.execute(
                f"DELETE FROM tool_antipatterns WHERE tool_name IN ({placeholders})",
                clean,
            )
            conn.execute(
                f"UPDATE tool_metrics SET consecutive_failures = 0, last_error = '' WHERE tool_name IN ({placeholders})",
                clean,
            )
            return cur.rowcount

    # ------------------------------------------------------------------
    # Episodic Tool Logs (Short-term Raw Events with TTL & Consolidation)
    # ------------------------------------------------------------------
    def record_episodic_tool_log(
        self,
        *,
        session_id: str,
        tool_name: str,
        args_dict: dict[str, Any] | None,
        ok: bool,
        elapsed_ms: int,
        error_text: str = "",
        output_snippet: str = "",
    ) -> None:
        now = _utc_now_iso()
        try:
            args_json = json.dumps(args_dict or {}, ensure_ascii=False, default=str)[:400]
        except Exception:
            args_json = "{}"
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO episodic_tool_logs (session_id, tool_name, args_json, ok, elapsed_ms, error_text, output_snippet, consolidated, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
                """,
                (
                    session_id or "",
                    tool_name,
                    args_json,
                    1 if ok else 0,
                    int(elapsed_ms),
                    (error_text or "")[:300],
                    (output_snippet or "")[:300],
                    now,
                ),
            )

    def get_unconsolidated_episodes(self, limit: int = 60) -> dict[str, list[dict[str, Any]]]:
        last_ts = self.get_meta("last_consolidation_at", "")
        with self._lock, self._connect() as conn:
            tool_rows = conn.execute(
                """
                SELECT * FROM episodic_tool_logs
                WHERE consolidated = 0
                ORDER BY id ASC
                LIMIT ?
                """,
                (int(limit),),
            ).fetchall()
            if last_ts:
                msg_rows = conn.execute(
                    "SELECT role, content, created_at FROM messages WHERE created_at > ? ORDER BY id DESC LIMIT 20",
                    (last_ts,),
                ).fetchall()
                fb_rows = conn.execute(
                    "SELECT prompt_preview, correction_text, created_at FROM feedback_log WHERE created_at > ? ORDER BY id DESC LIMIT 15",
                    (last_ts,),
                ).fetchall()
            else:
                msg_rows = conn.execute(
                    "SELECT role, content, created_at FROM messages ORDER BY id DESC LIMIT 20"
                ).fetchall()
                fb_rows = conn.execute(
                    "SELECT prompt_preview, correction_text, created_at FROM feedback_log ORDER BY id DESC LIMIT 15"
                ).fetchall()
        return {
            "tool_logs": [dict(r) for r in tool_rows],
            "recent_messages": list(reversed([dict(r) for r in msg_rows])),
            "recent_feedback": [dict(r) for r in fb_rows],
        }

    def mark_episodes_consolidated(self, log_ids: list[int]) -> int:
        if not log_ids:
            return 0
        placeholders = ",".join("?" for _ in log_ids)
        with self._lock, self._connect() as conn:
            cur = conn.execute(
                f"UPDATE episodic_tool_logs SET consolidated = 1 WHERE id IN ({placeholders})",
                [int(i) for i in log_ids],
            )
            return cur.rowcount

    def prune_old_episodic_logs(self, ttl_days: int = 14) -> int:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=max(1, int(ttl_days)))).isoformat(timespec="seconds")
        with self._lock, self._connect() as conn:
            cur = conn.execute(
                "DELETE FROM episodic_tool_logs WHERE created_at < ? AND consolidated = 1",
                (cutoff,),
            )
            return cur.rowcount

    def get_episodic_stats(self) -> dict[str, Any]:
        with self._lock, self._connect() as conn:
            total = conn.execute("SELECT COUNT(*) FROM episodic_tool_logs").fetchone()[0]
            uncons = conn.execute("SELECT COUNT(*) FROM episodic_tool_logs WHERE consolidated = 0").fetchone()[0]
            oldest = conn.execute("SELECT MIN(created_at) FROM episodic_tool_logs").fetchone()[0]
        return {
            "total_logs": int(total),
            "unconsolidated_logs": int(uncons),
            "oldest_log_at": str(oldest or ""),
            "last_consolidation_at": self.get_meta("last_consolidation_at", ""),
        }

    # ------------------------------------------------------------------
    # Prospective Memory (Backlog & Conditional / Session-Start Reminders)
    # ------------------------------------------------------------------
    def add_prospective_task(
        self,
        *,
        title: str,
        trigger_condition: str = "session_start",
        due_date: str = "",
        priority: str = "normal",
    ) -> dict[str, Any]:
        t = (title or "").strip()
        if not t:
            raise ValueError("Noi dung viec can nho khong duoc rong")
        trig = (trigger_condition or "session_start").strip()
        due = (due_date or "").strip()
        prio = (priority or "normal").strip().lower()
        if prio not in ("low", "normal", "high"):
            prio = "normal"
        now = _utc_now_iso()
        with self._lock, self._connect() as conn:
            existing = conn.execute(
                "SELECT * FROM prospective_tasks WHERE lower(title) = lower(?) AND status = 'pending'",
                (t,),
            ).fetchone()
            if existing is not None:
                return dict(existing)
            cur = conn.execute(
                """
                INSERT INTO prospective_tasks (title, trigger_condition, due_date, priority, status, created_at, completed_at)
                VALUES (?, ?, ?, ?, 'pending', ?, '')
                """,
                (t, trig, due, prio, now),
            )
            row = conn.execute("SELECT * FROM prospective_tasks WHERE id = ?", (cur.lastrowid,)).fetchone()
        return dict(row)

    def list_prospective_tasks(self, status: str = "pending", limit: int = 30) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            if status == "all":
                rows = conn.execute(
                    """
                    SELECT * FROM prospective_tasks
                    ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,
                             CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
                             id DESC
                    LIMIT ?
                    """,
                    (int(limit),),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT * FROM prospective_tasks
                    WHERE status = ?
                    ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
                             id DESC
                    LIMIT ?
                    """,
                    (status, int(limit)),
                ).fetchall()
        return [dict(r) for r in rows]

    def get_triggered_prospective_tasks(self, prompt: str = "", is_session_start: bool = False) -> list[dict[str, Any]]:
        pending = self.list_prospective_tasks(status="pending", limit=20)
        if not pending:
            return []
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        p_low = (prompt or "").lower()
        triggered: list[dict[str, Any]] = []
        for task in pending:
            trig = (task.get("trigger_condition") or "session_start").strip().lower()
            due = (task.get("due_date") or "").strip()
            is_due = bool(due and due <= today)
            kw_match = bool(trig and trig != "session_start" and any(k.strip() in p_low for k in trig.split(",") if k.strip()))
            if is_due or kw_match or (is_session_start and trig == "session_start"):
                triggered.append(task)
        return triggered[:5]

    def format_prospective_for_prompt(self, prompt: str = "", is_session_start: bool = False) -> str:
        items = self.get_triggered_prospective_tasks(prompt=prompt, is_session_start=is_session_start)
        if not items:
            return ""
        lines = []
        for it in items:
            due_tag = f" (han: {it['due_date']})" if it.get("due_date") else ""
            prio_tag = f"[{it['priority'].upper()}] " if it.get("priority") == "high" else ""
            lines.append(f"- {prio_tag}{it['title']}{due_tag}")
        return "\n".join(lines)

    def complete_prospective_task(self, task_id: int) -> bool:
        now = _utc_now_iso()
        with self._lock, self._connect() as conn:
            cur = conn.execute(
                "UPDATE prospective_tasks SET status = 'done', completed_at = ? WHERE id = ?",
                (now, int(task_id)),
            )
            return cur.rowcount > 0

    def delete_prospective_task(self, task_id: int) -> bool:
        with self._lock, self._connect() as conn:
            cur = conn.execute("DELETE FROM prospective_tasks WHERE id = ?", (int(task_id),))
            return cur.rowcount > 0

    # ------------------------------------------------------------------
    # Meta-Memory Auto-Flag (Detect Degraded / Failing Tools for Tab 2)
    # ------------------------------------------------------------------
    def dismiss_tool_flag(self, tool_name: str) -> bool:
        """Clear stale tool_metrics & tool_antipatterns for a flagged/phantom or deleted tool."""
        tn = (tool_name or "").strip()
        if not tn:
            return False
        with self._lock, self._connect() as conn:
            c1 = conn.execute("DELETE FROM tool_metrics WHERE tool_name = ?", (tn,)).rowcount
            c2 = conn.execute("DELETE FROM tool_antipatterns WHERE tool_name = ?", (tn,)).rowcount
            conn.execute("DELETE FROM tool_embeddings WHERE tool_name = ?", (tn,))
            return (c1 + c2) > 0

    def get_degraded_tools(
        self,
        *,
        min_calls: int = 3,
        fail_rate_threshold: float = 0.4,
        min_consec_fail: int = 2,
    ) -> list[dict[str, Any]]:
        metrics = self.get_tool_metrics_map()
        flagged: list[dict[str, Any]] = []
        for tname, m in metrics.items():
            calls = int(m.get("calls") or 0)
            fails = int(m.get("failures") or 0)
            consec = int(m.get("consecutive_failures") or 0)
            fail_rate = (fails / calls) if calls > 0 else 0.0
            if (calls >= min_calls and fail_rate >= fail_rate_threshold) or consec >= min_consec_fail:
                aps = self.get_antipatterns_for_tools([tname], limit_per_tool=2)
                reason_parts = []
                if consec >= min_consec_fail:
                    reason_parts.append(f"Lỗi liên tiếp {consec} lần")
                if calls >= min_calls and fail_rate >= fail_rate_threshold:
                    reason_parts.append(f"Tỉ lệ lỗi {round(fail_rate * 100, 1)}% ({fails}/{calls})")
                flagged.append(
                    {
                        "tool_name": tname,
                        "calls": calls,
                        "failures": fails,
                        "fail_rate_pct": round(fail_rate * 100.0, 1),
                        "consecutive_failures": consec,
                        "last_error": str(m.get("last_error") or ""),
                        "reason": " | ".join(reason_parts),
                        "antipatterns": [a["lesson_learned"] for a in aps],
                    }
                )
        flagged.sort(key=lambda x: (x["consecutive_failures"], x["fail_rate_pct"]), reverse=True)
        return flagged
