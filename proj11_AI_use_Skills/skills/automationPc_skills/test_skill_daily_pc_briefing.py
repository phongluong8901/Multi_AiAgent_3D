import pytest
from skill_daily_pc_briefing import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_daily_pc_briefing"
    assert TOOL_SCHEMA["description"] is not None
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "downloads_dir" in TOOL_SCHEMA["parameters"]

def test_unknown_action():
    result = execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_generate_briefing(tmp_path, monkeypatch):
    def mock_get_disk_usage():
        return {"total": 1000, "used": 500, "free": 500}

    def mock_list_recent_files(folder, hours, limit):
        return [str(tmp_path / "file1.txt")]

    monkeypatch.setattr("skill_daily_pc_briefing._get_disk_usage", mock_get_disk_usage)
    monkeypatch.setattr("skill_daily_pc_briefing._list_recent_files", mock_list_recent_files)

    (tmp_path / "file1.txt").write_text("content")
    result = execute(action="generate_briefing", downloads_dir=str(tmp_path))
    assert result["ok"]
    assert result["disk_usage"] == {"total": 1000, "used": 500, "free": 500}
    assert result["recent_files"] == [str(tmp_path / "file1.txt")]

def test_generate_briefing_no_files(tmp_path, monkeypatch):
    def mock_get_disk_usage():
        return {"total": 1000, "used": 500, "free": 500}

    def mock_list_recent_files(folder, hours, limit):
        return []

    monkeypatch.setattr("skill_daily_pc_briefing._get_disk_usage", mock_get_disk_usage)
    monkeypatch.setattr("skill_daily_pc_briefing._list_recent_files", mock_list_recent_files)

    result = execute(action="generate_briefing", downloads_dir=str(tmp_path))
    assert result["ok"]
    assert result["disk_usage"] == {"total": 1000, "used": 500, "free": 500}
    assert result["recent_files"] == []

def test_generate_briefing_with_files(tmp_path):
    (tmp_path / "file1.txt").write_text("content")
    (tmp_path / "file2.txt").write_text("content")
    (tmp_path / "file3.txt").write_text("content")
    (tmp_path / "file4.txt").write_text("content")
    (tmp_path / "file5.txt").write_text("content")
    (tmp_path / "file6.txt").write_text("content")
    (tmp_path / "file7.txt").write_text("content")
    (tmp_path / "file8.txt").write_text("content")
    (tmp_path / "file9.txt").write_text("content")
    (tmp_path / "file10.txt").write_text("content")
    (tmp_path / "file11.txt").write_text("content")
    (tmp_path / "file12.txt").write_text("content")
    (tmp_path / "file13.txt").write_text("content")
    (tmp_path / "file14.txt").write_text("content")
    (tmp_path / "file15.txt").write_text("content")
    (tmp_path / "file16.txt").write_text("content")

    result = execute(action="generate_briefing", downloads_dir=str(tmp_path), recent_hours=24)
    assert result["ok"]
    assert len(result["recent_files"]) == 15
