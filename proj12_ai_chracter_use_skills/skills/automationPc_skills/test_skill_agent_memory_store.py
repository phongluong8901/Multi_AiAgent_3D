import pytest
from skill_agent_memory_store import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_agent_memory_store"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "parameters" in TOOL_SCHEMA

def test_unknown_action():
    result = execute(action="unknown")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_remember_and_recall(tmp_path):
    db_path = tmp_path / "agent_memory_test.sqlite"
    result = execute(action="remember", key="test_key", value="test_value", db_path=str(db_path))
    assert result["ok"]
    
    result = execute(action="recall", key="test_key", db_path=str(db_path))
    assert result["ok"]
    assert result["value"] == "test_value"

def test_search_memory(tmp_path):
    db_path = tmp_path / "agent_memory_test.sqlite"
    execute(action="remember", key="test_key1", value="test_value1", db_path=str(db_path))
    execute(action="remember", key="test_key2", value="test_value2", db_path=str(db_path))
    
    result = execute(action="search_memory", query="test", db_path=str(db_path))
    assert result["ok"]
    assert len(result["results"]) == 2

def test_forget(tmp_path):
    db_path = tmp_path / "agent_memory_test.sqlite"
    execute(action="remember", key="test_key", value="test_value", db_path=str(db_path))
    
    result = execute(action="forget", key="test_key", db_path=str(db_path))
    assert result["ok"]
    
    result = execute(action="recall", key="test_key", db_path=str(db_path))
    assert not result["ok"]
    assert "Key not found" in result["error"]
