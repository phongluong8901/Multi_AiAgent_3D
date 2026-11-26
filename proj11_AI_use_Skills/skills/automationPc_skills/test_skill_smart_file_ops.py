import os
import pytest
from unittest.mock import patch, MagicMock
from skill_smart_file_ops import execute, TOOL_SCHEMA

@pytest.fixture
def mock_os():
    with patch('os.path.isdir') as mock_isdir, \
         patch('os.listdir') as mock_listdir, \
         patch('os.path.isfile') as mock_isfile, \
         patch('os.path.join') as mock_join, \
         patch('os.makedirs') as mock_makedirs, \
         patch('shutil.move') as mock_move, \
         patch('os.rename') as mock_rename, \
         patch('glob.glob') as mock_glob:
        yield mock_isdir, mock_listdir, mock_isfile, mock_join, mock_makedirs, mock_move, mock_rename, mock_glob

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_smart_file_ops"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "action" in TOOL_SCHEMA["parameters"]["properties"]
    assert "root" in TOOL_SCHEMA["parameters"]["properties"]
    assert "pattern" in TOOL_SCHEMA["parameters"]["properties"]
    assert "max_results" in TOOL_SCHEMA["parameters"]["properties"]
    assert "folder" in TOOL_SCHEMA["parameters"]["properties"]
    assert "find_str" in TOOL_SCHEMA["parameters"]["properties"]
    assert "replace_str" in TOOL_SCHEMA["parameters"]["properties"]
    assert "dry_run" in TOOL_SCHEMA["parameters"]["properties"]
    assert "action" in TOOL_SCHEMA["parameters"]["required"]

def test_execute_invalid_action():
    result = execute("invalid_action")
    assert result == {"ok": False, "error": "Invalid action"}

def test_search_files(mock_os):
    mock_glob = mock_os[7]
    mock_glob.return_value = ["/path/to/file1.txt", "/path/to/file2.txt"]
    result = execute("search_files", root="/path/to", pattern="*.txt")
    assert result == {"ok": True, "results": ["/path/to/file1.txt", "/path/to/file2.txt"]}

def test_organize_by_ext_dry_run(mock_os):
    mock_isdir = mock_os[0]
    mock_listdir = mock_os[1]
    mock_isfile = mock_os[2]
    mock_join = mock_os[3]
    mock_isdir.return_value = True
    mock_listdir.return_value = ["file1.txt", "file2.docx"]
    mock_isfile.side_effect = [True, True]
    mock_join.side_effect = ["/path/to/file1.txt", "/path/to/txt", "/path/to/txt/file1.txt", "/path/to/file2.docx", "/path/to/docx", "/path/to/docx/file2.docx"]
    result = execute("organize_by_ext", folder="/path/to", dry_run=True)
    assert result == {"ok": True}

def test_organize_by_ext(mock_os):
    mock_isdir = mock_os[0]
    mock_listdir = mock_os[1]
    mock_isfile = mock_os[2]
    mock_join = mock_os[3]
    mock_makedirs = mock_os[4]
    mock_move = mock_os[5]
    mock_isdir.return_value = True
    mock_listdir.return_value = ["file1.txt", "file2.docx"]
    mock_isfile.side_effect = [True, True]
    mock_join.side_effect = ["/path/to/file1.txt", "/path/to/txt", "/path/to/txt/file1.txt", "/path/to/file2.docx", "/path/to/docx", "/path/to/docx/file2.docx"]
    mock_makedirs.side_effect = [None, None]
    mock_move.side_effect = [None, None]
    result = execute("organize_by_ext", folder="/path/to", dry_run=False)
    assert result == {"ok": True}

def test_batch_rename_dry_run(mock_os):
    mock_isdir = mock_os[0]
    mock_listdir = mock_os[1]
    mock_join = mock_os[3]
    mock_isdir.return_value = True
    mock_listdir.return_value = ["oldname.txt", "anotherfile.txt"]
    mock_join.side_effect = ["/path/to/oldname.txt", "/path/to/newname.txt", "/path/to/anotherfile.txt"]
    result = execute("batch_rename", folder="/path/to", find_str="old", replace_str="new", dry_run=True)
    assert result == {"ok": True}

def test_batch_rename(mock_os):
    mock_isdir = mock_os[0]
    mock_listdir = mock_os[1]
    mock_join = mock_os[3]
    mock_rename = mock_os[6]
    mock_isdir.return_value = True
    mock_listdir.return_value = ["oldname.txt", "anotherfile.txt"]
    mock_join.side_effect = ["/path/to/oldname.txt", "/path/to/newname.txt", "/path/to/anotherfile.txt"]
    mock_rename.side_effect = [None]
    result = execute("batch_rename", folder="/path/to", find_str="old", replace_str="new", dry_run=False)
    assert result == {"ok": True}

def test_search_files_invalid_root(mock_os):
    mock_glob = mock_os[7]
    mock_glob.side_effect = OSError("Invalid root")
    result = execute("search_files", root="/invalid/path", pattern="*.txt")
    assert result == {"ok": False, "error": "Invalid root"}

def test_organize_by_ext_invalid_folder(mock_os):
    mock_isdir = mock_os[0]
    mock_isdir.return_value = False
    result = execute("organize_by_ext", folder="/invalid/path", dry_run=True)
    assert result == {"ok": False, "error": "Folder does not exist"}

def test_batch_rename_invalid_folder(mock_os):
    mock_isdir = mock_os[0]
    mock_isdir.return_value = False
    result = execute("batch_rename", folder="/invalid/path", find_str="old", replace_str="new", dry_run=True)
    assert result == {"ok": False, "error": "Folder does not exist"}
