import skill_dev_sqlite_state_scaffolder as mod
import pytest
from pathlib import Path

def test_tool_schema():
    assert "action" in mod.TOOL_SCHEMA["parameters"]["properties"]
    assert mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"] == ["generate_sqlite_schema_sql", "generate_sqlite_store_py", "init_and_smoke_db"]

def test_unknown_action():
    result = mod.execute("unknown_action", table_name="test_table", columns={"id": "INTEGER PRIMARY KEY", "value": "TEXT"})
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_generate_sqlite_schema_sql(tmp_path):
    result = mod.execute("generate_sqlite_schema_sql", table_name="test_table", columns={"id": "INTEGER PRIMARY KEY", "value": "TEXT"})
    assert result["ok"] is True
    assert result["schema_sql"] == "CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, value TEXT);"

def test_generate_sqlite_store_py(tmp_path):
    result = mod.execute("generate_sqlite_store_py", table_name="test_table", columns={"id": "INTEGER PRIMARY KEY", "value": "TEXT"}, db_path=tmp_path / "test.db")
    assert result["ok"] is True
    assert Path(result["file_path"]).exists()

def test_init_and_smoke_db(tmp_path):
    result = mod.execute("init_and_smoke_db", table_name="test_table", columns={"id": "INTEGER PRIMARY KEY", "value": "TEXT"}, db_path=tmp_path / "test.db")
    assert result["ok"] is True
    assert Path(result["db_path"]).exists()
