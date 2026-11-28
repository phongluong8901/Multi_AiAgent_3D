import pytest
from unittest.mock import patch, MagicMock
from skill_browser_bookmarks_history import TOOL_SCHEMA, execute

@pytest.fixture
def mock_bookmarks_file(tmp_path):
    import json
    bookmarks_data = {
        "roots": {
            "bookmark_bar": {
                "children": [
                    {"name": "Example Site", "url": "http://example.com"}
                ]
            },
            "other": {
                "children": [
                    {"name": "Another Site", "url": "http://anothersite.com"}
                ]
            }
        }
    }
    bookmarks_file = tmp_path / "Bookmarks"
    bookmarks_file.write_text(json.dumps(bookmarks_data))
    return bookmarks_file

@pytest.fixture
def mock_history_db(tmp_path):
    import sqlite3
    history_db = tmp_path / "History"
    conn = sqlite3.connect(history_db)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE urls (
            id INTEGER PRIMARY KEY,
            url TEXT,
            title TEXT,
            last_visit_time INTEGER
        )
    """)
    cursor.execute("INSERT INTO urls (url, title, last_visit_time) VALUES (?, ?, ?)", ("http://example.com", "Example Site", 123456789))
    conn.commit()
    conn.close()
    return history_db

@patch('skill_browser_bookmarks_history.get_chrome_bookmarks_path')
def test_search_bookmarks(mock_get_path, mock_bookmarks_file):
    mock_get_path.return_value = mock_bookmarks_file
    result = execute(action="search_bookmarks", query="example")
    assert result["ok"] is True
    assert len(result["results"]) == 1
    assert result["results"][0]["name"] == "Example Site"
    assert result["results"][0]["url"] == "http://example.com"

@patch('skill_browser_bookmarks_history.get_chrome_history_path')
def test_search_history(mock_get_path, mock_history_db):
    mock_get_path.return_value = mock_history_db
    result = execute(action="search_history", query="example")
    assert result["ok"] is True
    assert len(result["results"]) == 1
    assert result["results"][0]["url"] == "http://example.com"
    assert result["results"][0]["title"] == "Example Site"

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_browser_bookmarks_history"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA

def test_unknown_action():
    result = execute(action="unknown_action")
    assert result["ok"] is False
    assert "Unknown action" in result["error"]

def test_search_bookmarks_no_query():
    with patch('skill_browser_bookmarks_history.get_chrome_bookmarks_path', return_value="non_existent_path"):
        result = execute(action="search_bookmarks")
        assert result["ok"] is False
        assert "FileNotFoundError" in result["error"]

def test_search_history_no_query():
    with patch('skill_browser_bookmarks_history.get_chrome_history_path', return_value="non_existent_path"):
        result = execute(action="search_history")
        assert result["ok"] is False
        assert "FileNotFoundError" in result["error"]
