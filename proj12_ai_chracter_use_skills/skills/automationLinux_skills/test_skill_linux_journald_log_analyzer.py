import pytest
import skill_linux_journald_log_analyzer as mod
from unittest.mock import MagicMock

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_journald_log_analyzer"
    assert mod.TOOL_SCHEMA["risk_level"] == "safe"
    assert "action" in mod.TOOL_SCHEMA["parameters"]["properties"]
    assert set(mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]) == {"query_journal_logs", "analyze_log_lines", "detect_oom_events"}

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_query_journal_logs_dry_run(monkeypatch):
    mock_run_cmd = MagicMock(return_value=(0, "log1\nlog2", ""))
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.query_journal_logs(unit="test.service", priority="err", lines=10, dry_run=True)
    assert result == {"ok": True, "dry_run": True, "command": "journalctl -u test.service -p err -n 10"}

def test_analyze_log_lines():
    lines = ["Error: Something went wrong", "Warning: This is a warning", "Info: Just info"]
    result = mod.analyze_log_lines(lines)
    assert result == {"error": 1, "warning": 1}

def test_detect_oom_events():
    lines = ["Out of memory: Kill process 1234 (process_name)", "Normal log line"]
    result = mod.detect_oom_events(lines)
    assert result == ["process_name"]
