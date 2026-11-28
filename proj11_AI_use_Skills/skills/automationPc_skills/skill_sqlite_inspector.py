"""Read-Only SQLite Database Inspector (list tables, describe schema, safe SELECT queries)."""
import os
import re
import sqlite3
from typing import Any

FORBIDDEN_SQL = re.compile(r"\b(DROP|DELETE|UPDATE|INSERT|ALTER|REPLACE|CREATE|ATTACH|DETACH|VACUUM|REINDEX)\b", re.I)

TOOL_SCHEMA: dict[str, Any] = {
    "name": "skill_sqlite_inspector",
    "description": (
        "Kiểm tra và truy vấn cơ sở dữ liệu SQLite cục bộ an toàn ở chế độ chỉ đọc: liệt kê danh sách bảng, "
        "xem cấu trúc cột (schema), chạy câu lệnh SELECT (tự động chặn mọi lệnh xóa/sửa DROP/DELETE/UPDATE). "
        "Safe read-only SQLite inspector: list_tables, describe_table, query_readonly."
    ),
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["list_tables", "describe_table", "query_readonly"]},
            "db_path": {"type": "string", "description": "Đường dẫn tệp SQLite (.db / .sqlite)."},
            "table": {"type": "string", "description": "Tên bảng cần xem cấu trúc."},
            "sql": {"type": "string", "description": "Câu truy vấn SELECT chỉ đọc."},
            "limit": {"type": "integer", "description": "Số dòng tối đa trả về (mặc định: 50)."},
        },
        "required": ["action"],
    },
}


def _open_ro(db_path: str) -> sqlite3.Connection:
    if not db_path or not os.path.isfile(db_path):
        raise FileNotFoundError(f"SQLite DB not found: {db_path}")
    conn = sqlite3.connect(f"file:{os.path.abspath(db_path)}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def list_tables(db_path: str) -> dict[str, Any]:
    with _open_ro(db_path) as conn:
        rows = conn.execute("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name").fetchall()
        return {"ok": True, "db_path": os.path.abspath(db_path), "tables": [dict(r) for r in rows]}


def describe_table(db_path: str, table: str) -> dict[str, Any]:
    if not table or not re.fullmatch(r"[A-Za-z0-9_]+", table):
        return {"ok": False, "error": f"Invalid table name: {table}"}
    with _open_ro(db_path) as conn:
        cols = [dict(r) for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]
        cnt = conn.execute(f"SELECT COUNT(*) AS c FROM {table}").fetchone()["c"]
        return {"ok": True, "table": table, "row_count": cnt, "columns": cols}


def query_readonly(db_path: str, sql: str, limit: int = 50) -> dict[str, Any]:
    q = (sql or "").strip()
    if not q:
        return {"ok": False, "error": "SQL query cannot be empty"}
    if FORBIDDEN_SQL.search(q) or not re.match(r"^(SELECT|WITH|PRAGMA|EXPLAIN)\b", q, re.I):
        return {"ok": False, "error": "Blocked: only read-only SELECT/WITH/PRAGMA queries are allowed."}
    with _open_ro(db_path) as conn:
        cur = conn.execute(q)
        rows = [dict(r) for r in cur.fetchmany(max(1, min(int(limit or 50), 500)))]
        return {"ok": True, "count": len(rows), "rows": rows}


def execute(action: str = "list_tables", **kwargs: Any) -> dict[str, Any]:
    act = (action or "list_tables").strip().lower()
    try:
        if act == "list_tables":
            return list_tables(kwargs.get("db_path", ""))
        if act == "describe_table":
            return describe_table(kwargs.get("db_path", ""), kwargs.get("table", ""))
        if act == "query_readonly":
            return query_readonly(kwargs.get("db_path", ""), kwargs.get("sql", ""), kwargs.get("limit", 50))
        return {"ok": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
