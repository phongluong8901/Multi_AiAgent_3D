import pytest
import skill_linux_network_socket_audit as mod
from unittest.mock import MagicMock

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_network_socket_audit"
    assert "description" in mod.TOOL_SCHEMA
    assert mod.TOOL_SCHEMA["risk_level"] == "safe"
    assert "parameters" in mod.TOOL_SCHEMA

def test_parse_ss_listening(tmp_path):
    test_output = """tcp    0      0 127.0.0.1:22    0.0.0.0:*    users:(("sshd",pid=1234,fd=3))"""
    test_file = tmp_path / "ss_output.txt"
    test_file.write_text(test_output)
    with open(test_file, 'r') as file:
        raw_ss = file.read()
    result = mod.parse_ss_listening(raw_ss)
    assert result == [{"ip": "127.0.0.1", "port": "22"}]

def test_list_listening_ports(monkeypatch):
    mock_output = """tcp    0      0 127.0.0.1:22    0.0.0.0:*    users:(("sshd",pid=1234,fd=3))"""
    monkeypatch.setattr(mod, "_run_cmd", MagicMock(return_value=(0, mock_output, "")))
    result = mod.list_listening_ports()
    assert result == [{"ip": "127.0.0.1", "port": "22"}]

def test_check_tcp_endpoint(monkeypatch):
    monkeypatch.setattr(mod, "_tcp_connect", MagicMock(return_value=True))
    result = mod.check_tcp_endpoint("127.0.0.1", 22)
    assert result is True

def test_execute_parse_ss_listening():
    raw_ss = """tcp    0      0 127.0.0.1:22    0.0.0.0:*    users:(("sshd",pid=1234,fd=3))"""
    result = mod.execute("parse_ss_listening", raw_ss=raw_ss)
    assert result["ok"] is True
    assert result["data"] == [{"ip": "127.0.0.1", "port": "22"}]

def test_execute_unknown_action():
    result = mod.execute("unknown_action")
    assert result["ok"] is False
    assert "Unknown action" in result["error"]
