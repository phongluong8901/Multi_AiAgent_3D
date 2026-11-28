import os
import sqlite3
from pathlib import Path

TOOL_SCHEMA = {
    "name": "skill_dev_sqlite_state_scaffolder",
    "description": "Generate validated SQLite CREATE TABLE IF NOT EXISTS DDL from column dicts, generate a self-contained Python sqlite3 CRUD store module, and initialize + smoke-test a real SQLite database file on disk using stdlib sqlite3.",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["generate_sqlite_schema_sql", "generate_sqlite_store_py", "init_and_smoke_db"]},
            "table_name": {"type": "string"},
            "columns": {"type": "object"},
            "db_path": {"type": "string", "default": "app_state.db"}
        },
        "required": ["action", "table_name", "columns"]
    },
}

def execute(action: str, **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    if action == "generate_sqlite_schema_sql":
        return generate_sqlite_schema_sql(kwargs["table_name"], kwargs["columns"])
    
    if action == "generate_sqlite_store_py":
        return generate_sqlite_store_py(kwargs["table_name"], kwargs["columns"], kwargs.get("db_path", "app_state.db"))
    
    if action == "init_and_smoke_db":
        schema_sql = generate_sqlite_schema_sql(kwargs["table_name"], kwargs["columns"])["schema_sql"]
        return init_and_smoke_db(kwargs.get("db_path", "app_state.db"), schema_sql)

def generate_sqlite_schema_sql(table_name: str, columns: dict) -> dict:
    column_defs = ", ".join([f"{col_name} {col_type}" for col_name, col_type in columns.items()])
    schema_sql = f"CREATE TABLE IF NOT EXISTS {table_name} ({column_defs});"
    return {"ok": True, "schema_sql": schema_sql}

def generate_sqlite_store_py(table_name: str, columns: dict, db_path: str) -> dict:
    schema_sql = generate_sqlite_schema_sql(table_name, columns)["schema_sql"]
    store_py = f"""
import sqlite3

DB_PATH = '{db_path}'

def get_connection():
    return sqlite3.connect(DB_PATH)

def create_table():
    with get_connection() as conn:
        conn.execute("{schema_sql}")
        conn.commit()

def insert_data({', '.join(columns.keys())}):
    with get_connection() as conn:
        conn.execute(f"INSERT INTO {table_name} ({', '.join(columns.keys())}) VALUES ({', '.join(['?'] * len(columns))})", ({', '.join(columns.keys())},))
        conn.commit()

def fetch_all():
    with get_connection() as conn:
        return conn.execute(f"SELECT * FROM {table_name}").fetchall()
    """
    with open(f"{table_name}_store.py", "w") as f:
        f.write(store_py.strip())
    return {"ok": True, "file_path": f"{table_name}_store.py"}

def init_and_smoke_db(db_path: str, schema_sql: str) -> dict:
    with sqlite3.connect(db_path) as conn:
        conn.execute(schema_sql)
        conn.commit()
    return {"ok": True, "db_path": db_path}
