import pytest
from unittest.mock import patch, MagicMock
from skill_markdown_note_vault import execute, TOOL_SCHEMA

@pytest.fixture
def mock_pathlib():
    mock_path = MagicMock()
    mock_path.return_value.glob.return_value = [
        MagicMock(stem="2023-10-01", stat=MagicMock(st_mtime=1696128000)),
        MagicMock(stem="2023-10-02", stat=MagicMock(st_mtime=1696214400)),
        MagicMock(stem="2023-10-03", stat=MagicMock(st_mtime=1696300800))
    ]
    mock_path.return_value.open.return_value.__enter__.return_value.read.return_value = "# Sample Note\n#tag1"
    return mock_path

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_markdown_note_vault"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA

def test_create_daily_note_dry_run(mock_pathlib):
    with patch("pathlib.Path", return_value=MagicMock()):
        result = execute("create_daily_note", vault_dir=".", content="Test content", dry_run=True)
        assert result["ok"] is True
        assert "preview" in result

def test_create_daily_note(mock_pathlib):
    with patch("pathlib.Path", return_value=MagicMock()):
        result = execute("create_daily_note", vault_dir=".", content="Test content", dry_run=False)
        assert result["ok"] is True
        assert "message" in result

def test_search_notes_dry_run(mock_pathlib):
    with patch("pathlib.Path", return_value=MagicMock()):
        result = execute("search_notes", vault_dir=".", query="Sample", tag="#tag1", dry_run=True)
        assert result["ok"] is True
        assert "preview" in result

def test_search_notes(mock_pathlib):
    with patch("pathlib.Path", return_value=MagicMock()):
        result = execute("search_notes", vault_dir=".", query="Sample", tag="#tag1", dry_run=False)
        assert result["ok"] is True
        assert "results" in result

def test_list_recent_notes_dry_run(mock_pathlib):
    with patch("pathlib.Path", return_value=MagicMock()):
        result = execute("list_recent_notes", vault_dir=".", limit=2, dry_run=True)
        assert result["ok"] is True
        assert "preview" in result

def test_list_recent_notes(mock_pathlib):
    with patch("pathlib.Path", return_value=MagicMock()):
        result = execute("list_recent_notes", vault_dir=".", limit=2, dry_run=False)
        assert result["ok"] is True
        assert "recent_notes" in result

def test_unknown_action():
    result = execute("unknown_action")
    assert result["ok"] is False
    assert "error" in result
