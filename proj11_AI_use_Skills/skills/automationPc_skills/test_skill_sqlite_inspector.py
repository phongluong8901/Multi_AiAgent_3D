import sqlite3
import skill_sqlite_inspector as mod

def test_readonly_and_block_drop(tmp_path):
    db = tmp_path / "test.sqlite"
    with sqlite3.connect(db) as c:
        c.execute("CREATE TABLE items (id INT, name TEXT)")
        c.execute("INSERT INTO items VALUES (1, 'A')")
    assert mod.execute("list_tables", db_path=str(db))["tables"][0]["name"] == "items"
    assert mod.execute("describe_table", db_path=str(db), table="items")["row_count"] == 1
    assert mod.execute("query_readonly", db_path=str(db), sql="SELECT * FROM items")["count"] == 1
    assert mod.execute("query_readonly", db_path=str(db), sql="DROP TABLE items")["ok"] is False
