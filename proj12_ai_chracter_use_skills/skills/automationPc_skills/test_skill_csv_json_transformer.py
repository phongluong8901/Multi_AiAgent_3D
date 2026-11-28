import pytest
import sys
import types
from unittest.mock import MagicMock
from skill_csv_json_transformer import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_csv_json_transformer"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA

def test_execute_unknown_action():
    result = execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_csv_to_json(monkeypatch):
    mock_pandas = MagicMock()
    mock_pandas.read_csv.return_value.head.return_value.to_json.return_value = '[{"col1": "val1"}]'
    monkeypatch.setitem(sys.modules, "pandas", mock_pandas)
    
    result = execute(action="csv_to_json", csv_path="test.csv")
    assert result == {"ok": True, "data": '[{"col1": "val1"}]'}

def test_csv_to_json_missing_pandas(monkeypatch):
    monkeypatch.setitem(sys.modules, "pandas", None)
    result = execute(action="csv_to_json", csv_path="test.csv")
    assert result == {"ok": False, "error": "Missing package pandas"}

def test_json_to_markdown_table(monkeypatch):
    import json  # Import json here for the test
    records = [{"col1": "val1", "col2": "val2"}, {"col1": "val3", "col2": "val4"}]
    result = execute(action="json_to_markdown_table", json_data=json.dumps(records))
    expected = (
        "| col1 | col2 |\n"
        "| --- | --- |\n"
        "| val1 | val2 |\n"
        "| val3 | val4 |"
    )
    assert result == {"ok": True, "data": expected}

def test_json_to_markdown_table_no_data():
    result = execute(action="json_to_markdown_table", json_data="[]")
    assert result == {"ok": False, "error": "No data to convert"}

def test_column_stats(monkeypatch):
    mock_pandas = MagicMock()
    mock_df = MagicMock()
    mock_series = MagicMock()
    mock_series.sum.return_value = 10
    mock_series.mean.return_value = 2.5
    mock_series.min.return_value = 1
    mock_series.max.return_value = 5
    mock_df.__getitem__.return_value = mock_series
    mock_df.columns = ["col1"]
    mock_pandas.read_csv.return_value = mock_df
    monkeypatch.setitem(sys.modules, "pandas", mock_pandas)
    
    result = execute(action="column_stats", csv_path="test.csv", column="col1")
    assert result == {"ok": True, "data": {"sum": 10, "avg": 2.5, "min": 1, "max": 5}}

def test_column_stats_missing_pandas(monkeypatch):
    monkeypatch.setitem(sys.modules, "pandas", None)
    result = execute(action="column_stats", csv_path="test.csv", column="col1")
    assert result == {"ok": False, "error": "Missing package pandas"}

def test_column_stats_column_not_found(monkeypatch):
    mock_pandas = MagicMock()
    mock_df = MagicMock()
    mock_df.columns = ["col2"]
    mock_pandas.read_csv.return_value = mock_df
    monkeypatch.setitem(sys.modules, "pandas", mock_pandas)
    
    result = execute(action="column_stats", csv_path="test.csv", column="col1")
    assert result == {"ok": False, "error": "Column col1 not found in CSV"}
