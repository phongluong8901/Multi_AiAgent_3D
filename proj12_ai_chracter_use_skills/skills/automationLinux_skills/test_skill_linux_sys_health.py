import skill_linux_sys_health as mod
import pytest
from pathlib import Path

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_sys_health"
    assert mod.TOOL_SCHEMA["risk_level"] == "safe"
    assert "action" in mod.TOOL_SCHEMA["parameters"]["properties"]
    assert set(mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]) == {"get_cpu_ram_summary", "get_disk_usage", "parse_uptime_load"}

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result["ok"] is False
    assert "Unknown action" in result["error"]

def test_get_cpu_ram_summary_dry_run(tmp_path):
    result = mod.execute(action="get_cpu_ram_summary", proc_dir=str(tmp_path), dry_run=True)
    assert result["ok"] is True
    assert result["dry_run"] is True

def test_get_disk_usage_dry_run(tmp_path):
    result = mod.execute(action="get_disk_usage", paths=[str(tmp_path)], dry_run=True)
    assert result["ok"] is True
    assert result["dry_run"] is True

def test_parse_uptime_load_dry_run():
    result = mod.execute(action="parse_uptime_load", raw_uptime="up 2 days, 3:45", dry_run=True)
    assert result["ok"] is True
    assert result["dry_run"] is True

def test_parse_uptime_load(tmp_path, monkeypatch):
    def mock_read_file(file_path: Path) -> str:
        return " 23:45:01 up 2 days, 3:45,  1 user,  load average: 0.00, 0.01, 0.05"
    
    monkeypatch.setattr(mod, "_read_file", mock_read_file)
    result = mod.execute(action="parse_uptime_load", raw_uptime="up 2 days, 3:45", dry_run=False)
    assert result["ok"] is True
    assert result["data"]["uptime_seconds"] == 186300  # Đổi 183900 thành 186300

def test_get_cpu_ram_summary(tmp_path, monkeypatch):
    meminfo_content = """MemTotal:        8178304 kB
MemFree:         2048000 kB
MemAvailable:    4096000 kB"""
    loadavg_content = "0.00 0.01 0.05 1/200 12345"
    
    def mock_read_file(file_path: Path) -> str:
        if file_path.name == "meminfo":
            return meminfo_content
        elif file_path.name == "loadavg":
            return loadavg_content
        return ""
    
    monkeypatch.setattr(mod, "_read_file", mock_read_file)
    result = mod.execute(action="get_cpu_ram_summary", proc_dir=str(tmp_path), dry_run=False)
    assert result["ok"] is True
    assert result["data"]["total_memory"] == 8178304 * 1024
    assert result["data"]["free_memory"] == 2048000 * 1024
    assert result["data"]["available_memory"] == 4096000 * 1024
    assert result["data"]["load_average"]["1min"] == 0.00
    assert result["data"]["load_average"]["5min"] == 0.01
    assert result["data"]["load_average"]["15min"] == 0.05
    assert result["data"]["load_average"]["running_processes"] == 1
    assert result["data"]["load_average"]["total_processes"] == 200
    assert result["data"]["load_average"]["last_pid"] == 12345
