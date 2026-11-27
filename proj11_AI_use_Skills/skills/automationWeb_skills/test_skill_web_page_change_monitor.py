import pytest
from unittest.mock import patch
from skill_web_page_change_monitor import execute, normalize_content, compute_sha256

def test_tool_schema():
    schema = execute(action="schema")
    assert schema["ok"] is False
    assert "schema" not in schema

def test_unknown_action():
    result = execute(action="unknown_action")
    assert result["ok"] is False
    assert "Unknown action." in result["error"]

def test_normalize_content():
    text = "  Hello World!  "
    normalized = normalize_content(text)
    assert normalized == "hello world!"

def test_check_and_update_snapshot(tmp_path):
    store_path = tmp_path / "web_monitors.json"
    monitor_id = "test_monitor"
    current_text = "Initial content"
    
    result = execute(action="check_and_update_snapshot", monitor_id=monitor_id, current_text=current_text, store_path=str(store_path))
    assert result["ok"] is True
    assert "Snapshot saved." in result["message"]
    
    new_text = "Updated content"
    result = execute(action="check_and_update_snapshot", monitor_id=monitor_id, current_text=new_text, store_path=str(store_path))
    assert result["ok"] is True
    assert len(result["diff"]) > 0

def test_list_monitors(tmp_path):
    store_path = tmp_path / "web_monitors.json"
    monitor_id = "test_monitor"
    current_text = "Initial content"
    
    execute(action="check_and_update_snapshot", monitor_id=monitor_id, current_text=current_text, store_path=str(store_path))
    
    result = execute(action="list_monitors", store_path=str(store_path))
    assert result["ok"] is True
    assert monitor_id in result["monitors"]
