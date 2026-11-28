import pytest
import skill_linux_process_cgroups_guard as mod

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_process_cgroups_guard"
    assert mod.TOOL_SCHEMA["risk_level"] == "confirm"
    assert "action" in mod.TOOL_SCHEMA["parameters"]["properties"]
    assert set(mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]) == {"find_processes", "find_port_owner", "send_signal"}

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_find_processes(monkeypatch):
    def mock_run_cmd(cmd):
        if cmd == ['ps', 'aux']:
            return 0, "USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND\nroot 1 0.0 0.1 12345 6789 ? Ss 12:34 0:01 /sbin/init\nuser 1234 0.1 0.2 23456 3456 pts/0 S+ 12:35 0:00 python3 script.py", ""
        return 1, "", "Error"
    
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.find_processes(query="python")
    assert result["ok"]
    assert len(result["processes"]) == 1
    assert result["processes"][0]["pid"] == "1234"

def test_find_port_owner(monkeypatch):
    def mock_run_cmd(cmd):
        if cmd == ['lsof', '-i', ':8000']:
            return 0, "COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME\npython3 1234 user 5u IPv4 12345 0t0 TCP *:http-alt (LISTEN)", ""
        return 1, "", "Error"
    
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.find_port_owner(port=8000)
    assert result["ok"]
    assert len(result["processes"]) == 1
    assert result["processes"][0]["pid"] == "1234"

def test_send_signal(monkeypatch):
    def mock_run_cmd(cmd):
        if cmd == ['kill', '-TERM', '1234']:
            return 0, "", ""
        return 1, "", "Error"
    
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.send_signal(pid=1234, sig='TERM', dry_run=False)
    assert result["ok"]
    assert "Sent signal TERM to PID 1234" in result["message"]

def test_send_signal_dry_run():
    result = mod.send_signal(pid=1234, sig='TERM', dry_run=True)
    assert result["ok"]
    assert "Dry run: Would send signal TERM to PID 1234" in result["message"]
