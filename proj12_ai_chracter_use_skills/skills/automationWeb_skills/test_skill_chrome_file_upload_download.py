import pytest
import os
import time
from skill_chrome_file_upload_download import execute, TOOL_SCHEMA
import builtins

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_chrome_file_upload_download"
    assert TOOL_SCHEMA["description"] is not None
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "action" in TOOL_SCHEMA["parameters"]

def test_unknown_action():
    result = execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_prepare_upload_dry_run(tmp_path):
    file_path = tmp_path / "test.txt"
    file_path.write_text("test content")
    result = execute(action="prepare_upload", file_paths=[str(file_path)], dry_run=True)
    assert result["ok"]
    assert "Dry run completed" in result["message"]

def test_prepare_upload_missing_requests(monkeypatch):
    real_import = builtins.__import__
    def mock_import_requests(name, *args, **kwargs):
        if name == 'requests':
            raise ImportError("Mocked ImportError for requests")
        return real_import(name, *args, **kwargs)
    monkeypatch.setattr(builtins, '__import__', mock_import_requests)
    result = execute(action="prepare_upload", file_paths=["/path/to/file"], dry_run=False)
    assert not result["ok"]
    assert "Missing package requests" in result["error"]

def test_scan_chrome_downloads(tmp_path):
    file_path = tmp_path / "test.txt"
    file_path.write_text("test content")
    time.sleep(1)  # Ensure file modification time is recent
    result = execute(action="scan_chrome_downloads", downloads_dir=str(tmp_path), recent_minutes=1)
    assert result["ok"]
    assert str(file_path) in result["new_downloads"]
    assert not result["in_progress_downloads"]
