import pytest
from unittest.mock import MagicMock
from skill_chrome_tab_workspace import execute, TOOL_SCHEMA, deduplicate_tabs, filter_tabs_by_domain, save_session, load_session, close_tabs_by_domain

def test_tool_schema():
    assert isinstance(TOOL_SCHEMA, dict)
    assert "name" in TOOL_SCHEMA
    assert "description" in TOOL_SCHEMA
    assert "risk_level" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA

def test_unknown_action():
    result = execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action"}

def test_deduplicate_tabs():
    tabs = [
        {"id": 1, "url": "http://example.com"},
        {"id": 2, "url": "http://example.com"},
        {"id": 3, "url": "http://another.com"}
    ]
    result = deduplicate_tabs(tabs)
    assert len(result) == 2
    assert result[0]["id"] == 1
    assert result[1]["id"] == 3

def test_filter_tabs_by_domain():
    tabs = [
        {"id": 1, "url": "http://example.com"},
        {"id": 2, "url": "http://another.com"},
        {"id": 3, "url": "http://example.com/page"}
    ]
    result = filter_tabs_by_domain(tabs, "example.com")
    assert len(result) == 2
    assert result[0]["id"] == 1
    assert result[1]["id"] == 3

def test_save_and_load_session(tmp_path):
    file_path = tmp_path / "chrome_session.json"
    tabs = [
        {"id": 1, "url": "http://example.com"},
        {"id": 2, "url": "http://another.com"}
    ]
    save_result = save_session(tabs, str(file_path))
    assert save_result == {"ok": True}

    load_result = load_session(str(file_path))
    assert load_result == {"ok": True, "data": tabs}

def test_close_tabs_by_domain(monkeypatch):
    mock_fetch_raw = MagicMock(side_effect=[
        [{"id": 1, "url": "http://example.com", "closeUrl": "http://localhost:9222/close/1"},
         {"id": 2, "url": "http://another.com", "closeUrl": "http://localhost:9222/close/2"}],
        {"ok": True}
    ])
    monkeypatch.setattr("skill_chrome_tab_workspace._fetch_raw", mock_fetch_raw)

    result = close_tabs_by_domain(domain="example.com", dry_run=False)
    assert result == {"ok": True}
    assert mock_fetch_raw.call_count == 2
