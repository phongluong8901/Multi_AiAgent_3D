import os
import pytest
from unittest.mock import patch, MagicMock
from skill_folder_watcher import execute, TOOL_SCHEMA

@pytest.fixture
def mock_os_listdir():
    with patch('os.listdir') as mock:
        mock.return_value = ['file1.txt', 'file2.docx', 'image.png']
        yield mock

@pytest.fixture
def mock_os_makedirs():
    with patch('os.makedirs') as mock:
        yield mock

@pytest.fixture
def mock_os_rename():
    with patch('os.rename') as mock:
        yield mock

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_folder_watcher"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA

def test_evaluate_rules():
    rules = [
        {"pattern": r".*\.txt", "destination": "texts"},
        {"pattern": r".*\.docx", "destination": "documents"}
    ]
    result = execute(action="evaluate_rules", filename="file1.txt", rules=rules)
    assert result["ok"] is True
    assert len(result["matches"]) == 1
    assert result["matches"][0]["destination"] == "texts"

def test_scan_folder_once_dry_run(mock_os_listdir):
    rules = [
        {"pattern": r".*\.txt", "destination": "texts"},
        {"pattern": r".*\.docx", "destination": "documents"}
    ]
    result = execute(action="scan_folder_once", folder=".", rules=rules, dry_run=True)
    assert result["ok"] is True
    assert len(result["results"]) == 2
    assert result["results"][0]["action"] == "move (dry run)"
    assert result["results"][1]["action"] == "move (dry run)"

def test_scan_folder_once_no_dry_run(mock_os_listdir, mock_os_makedirs, mock_os_rename):
    rules = [
        {"pattern": r".*\.txt", "destination": "texts"},
        {"pattern": r".*\.docx", "destination": "documents"}
    ]
    result = execute(action="scan_folder_once", folder=".", rules=rules, dry_run=False)
    assert result["ok"] is True
    assert len(result["results"]) == 2
    assert result["results"][0]["action"] == "moved"
    assert result["results"][1]["action"] == "moved"
    mock_os_makedirs.assert_called()
    mock_os_rename.assert_called()

def test_scan_folder_once_no_rules(mock_os_listdir):
    result = execute(action="scan_folder_once", folder=".", rules=[], dry_run=True)
    assert result["ok"] is True
    assert len(result["results"]) == 0

def test_scan_folder_once_invalid_action():
    result = execute(action="invalid_action")
    assert result["ok"] is False
    assert "Unknown action" in result["error"]
