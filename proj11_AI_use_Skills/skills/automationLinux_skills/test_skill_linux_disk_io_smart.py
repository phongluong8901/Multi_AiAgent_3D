import pytest
import skill_linux_disk_io_smart as mod
from unittest.mock import MagicMock

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_disk_io_smart"

def test_execute_unknown_action():
    result = mod.execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_parse_df_output(monkeypatch):
    mock_output = """Filesystem     1K-blocks    Used Available Use% Mounted on
    /dev/sda1       2000000 1000000   1000000  50% /
    /dev/sdb1       1000000  500000    500000  50% /mnt"""
    monkeypatch.setattr(mod, "_run_cmd", MagicMock(return_value=(0, mock_output, "")))
    result = mod.execute(action="parse_df_output", raw_df=mock_output)
    assert result["ok"]
    assert len(result["data"]) == 2
    assert result["data"][0]["filesystem"] == "/dev/sda1"
    assert result["data"][1]["filesystem"] == "/dev/sdb1"

def test_find_log_bloat(tmp_path):
    (tmp_path / "large_log.log").write_bytes(b'a' * 60 * 1024 * 1024)
    (tmp_path / "small_log.log").write_bytes(b'a' * 40 * 1024 * 1024)
    result = mod.execute(action="find_log_bloat", root_dir=str(tmp_path), min_mb=50)
    assert result["ok"]
    assert len(result["data"]) == 1
    assert result["data"][0]["path"].endswith("large_log.log")
    assert result["data"][0]["size_mb"] == 60.0

def test_list_block_devices(monkeypatch):
    mock_output = '{"blockdevices": [{"name": "sda", "size": "2000000000"}]}'
    monkeypatch.setattr(mod, "_run_cmd", MagicMock(return_value=(0, mock_output, "")))
    result = mod.execute(action="list_block_devices")
    assert result["ok"]
    assert result["data"]["blockdevices"][0]["name"] == "sda"
    assert result["data"]["blockdevices"][0]["size"] == "2000000000"
