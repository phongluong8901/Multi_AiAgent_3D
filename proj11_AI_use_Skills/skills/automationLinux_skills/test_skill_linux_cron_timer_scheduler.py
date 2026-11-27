import pytest
import skill_linux_cron_timer_scheduler as mod
from unittest.mock import MagicMock, mock_open

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_cron_timer_scheduler"

def test_validate_cron_expr():
    assert mod.validate_cron_expr("0 1 * * *") is True
    assert mod.validate_cron_expr("0 1 * *") is False
    assert mod.validate_cron_expr("0 1 * * * *") is False
    assert mod.validate_cron_expr("* * * * *") is True

def test_parse_crontab(tmp_path):
    crontab_content = """* * * * * /usr/bin/command1
# This is a comment
1 2 3 4 5 /usr/bin/command2"""
    crontab_file = tmp_path / "crontab"
    crontab_file.write_text(crontab_content)
    with open(crontab_file, "r") as f:
        raw_crontab = f.read()
    entries = mod.parse_crontab(raw_crontab)
    assert len(entries) == 2
    assert entries[0] == {"expression": "* * * * *", "command": "/usr/bin/command1"}
    assert entries[1] == {"expression": "1 2 3 4 5", "command": "/usr/bin/command2"}

def test_build_cron_entry(monkeypatch):
    m = mock_open()
    monkeypatch.setattr("builtins.open", m)
    result = mod.build_cron_entry("0 1 * * *", "/usr/bin/command", "Daily backup", dry_run=False)
    assert result["ok"] is True
    m.assert_called_once_with("/etc/crontab", "a")
    handle = m()
    handle.write.assert_called_once_with("# Daily backup\n0 1 * * * /usr/bin/command\n")

def test_list_systemd_timers(monkeypatch):
    mock_run_cmd = MagicMock(return_value=(0, "timer1\ntimer2", ""))
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute("list_systemd_timers")
    assert result["ok"] is True
    assert result["timers"] == ["timer1", "timer2"]
    mock_run_cmd.assert_called_once_with(["systemctl", "list-timers", "--all", "--no-pager"])

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result["ok"] is False
    assert "Unknown action" in result["error"]
