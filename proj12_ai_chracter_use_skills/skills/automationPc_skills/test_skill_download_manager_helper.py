import pytest
from skill_download_manager_helper import execute, TOOL_SCHEMA

def test_tool_schema():
    assert isinstance(TOOL_SCHEMA, dict)
    assert TOOL_SCHEMA["name"] == "skill_download_manager_helper"
    assert TOOL_SCHEMA["risk_level"] == "confirm"

def test_unknown_action():
    result = execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_compute_hash(tmp_path):
    test_file = tmp_path / "test.txt"
    test_file.write_text("Hello, World!")
    result = execute(action="compute_hash", file_path=str(test_file))
    assert result["ok"]
    assert result["hash"] == "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f"

def test_verify_checksum(tmp_path):
    test_file = tmp_path / "test.txt"
    test_file.write_text("Hello, World!")
    result = execute(action="verify_checksum", file_path=str(test_file), expected_hash="dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f")
    assert result["ok"]

def test_download_file_dry_run(monkeypatch):
    def mock_download_file(*args, **kwargs):
        return {"ok": True, "message": "Dry run: Would download http://example.com/file.txt to /tmp/file.txt"}
    monkeypatch.setattr("skill_download_manager_helper._download_file", mock_download_file)
    result = execute(action="download_file", url="http://example.com/file.txt", dest_dir="/tmp", dry_run=True)
    assert result["ok"]
    assert "Dry run" in result["message"]
