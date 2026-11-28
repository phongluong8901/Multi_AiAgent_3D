import pytest
from unittest.mock import patch, MagicMock
from skill_shortcut_desktop_manager import execute, TOOL_SCHEMA

@pytest.fixture
def mock_os():
    with patch('os.path.expanduser', return_value='/home/user'):
        with patch('os.listdir', return_value=['file1.txt', 'file2.txt']):
            yield

@pytest.fixture
def mock_win32com():
    mock = MagicMock()
    mock.Dispatch.return_value.CreateShortCut.return_value = MagicMock()
    with patch.dict('sys.modules', {'win32com.client': mock}):
        yield mock

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_shortcut_desktop_manager"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA
    assert "action" in TOOL_SCHEMA["parameters"]["properties"]
    assert "name" in TOOL_SCHEMA["parameters"]["properties"]
    assert "target_path" in TOOL_SCHEMA["parameters"]["properties"]
    assert "dry_run" in TOOL_SCHEMA["parameters"]["properties"]

def test_execute_list_desktop_items(mock_os):
    result = execute("list_desktop_items")
    assert result["ok"] is True
    assert result["items"] == ['file1.txt', 'file2.txt']

def test_execute_create_shortcut_dry_run(mock_os, mock_win32com):
    result = execute("create_shortcut", name="TestShortcut", target_path="/path/to/target")
    assert result["ok"] is True
    assert "preview" in result

def test_execute_create_shortcut(mock_os, mock_win32com):
    result = execute("create_shortcut", name="TestShortcut", target_path="/path/to/target", dry_run=False)
    assert result["ok"] is True
    assert "message" in result

def test_execute_desktop_summary(mock_os):
    result = execute("desktop_summary")
    assert result["ok"] is True
    assert result["summary"]["total_items"] == 2
    assert result["summary"]["items"] == ['file1.txt', 'file2.txt']

def test_execute_unknown_action():
    result = execute("unknown_action")
    assert result["ok"] is False
    assert "error" in result

def test_execute_missing_name(mock_os, mock_win32com):
    result = execute("create_shortcut", target_path="/path/to/target", dry_run=False)
    assert result["ok"] is False
    assert "error" in result

def test_execute_missing_target_path(mock_os, mock_win32com):
    result = execute("create_shortcut", name="TestShortcut", dry_run=False)
    assert result["ok"] is False
    assert "error" in result
