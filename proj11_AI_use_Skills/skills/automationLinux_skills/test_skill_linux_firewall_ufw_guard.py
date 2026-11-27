import pytest
import skill_linux_firewall_ufw_guard as mod
from pathlib import Path

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_firewall_ufw_guard"
    assert mod.TOOL_SCHEMA["description"] is not None
    assert mod.TOOL_SCHEMA["risk_level"] == "confirm"
    assert "action" in mod.TOOL_SCHEMA["parameters"]["properties"]

def test_execute_unknown_action():
    result = mod.execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_parse_ufw_status(monkeypatch):
    raw_ufw = "22/tcp                    ALLOW       Anywhere\n80/tcp                    ALLOW       Anywhere\n"
    monkeypatch.setattr(mod, "_run_cmd", lambda cmd: (0, raw_ufw, ""))
    result = mod.execute(action="parse_ufw_status", raw_ufw=raw_ufw)
    assert result["ok"]
    assert len(result["rules"]) == 2
    assert result["rules"][0]["port"] == 22
    assert result["rules"][1]["port"] == 80

def test_audit_exposed_ports(tmp_path):
    rules = [
        {"port": 22, "proto": "tcp", "action": "allow", "from_ip": "Anywhere"},
        {"port": 80, "proto": "tcp", "action": "allow", "from_ip": "Anywhere"},
        {"port": 443, "proto": "tcp", "action": "allow", "from_ip": "Anywhere"}
    ]
    allowlist_ports = [22, 443]
    result = mod.execute(action="audit_exposed_ports", rules=rules, allowlist_ports=allowlist_ports)
    assert result["ok"]
    assert len(result["exposed_ports"]) == 1
    assert result["exposed_ports"][0]["port"] == 80

def test_build_ufw_rule_dry_run(monkeypatch):
    monkeypatch.setattr(mod, "_run_cmd", lambda cmd: (0, "Rule added", ""))
    result = mod.execute(action="build_ufw_rule", port=8080, proto="tcp", rule_op="allow", from_ip="any", dry_run=True)
    assert result["ok"]
    assert result["command"] == "ufw allow 8080/tcp from any"

def test_build_ufw_rule_no_dry_run(monkeypatch):
    monkeypatch.setattr(mod, "_run_cmd", lambda cmd: (0, "Rule added", ""))
    result = mod.execute(action="build_ufw_rule", port=8080, proto="tcp", rule_op="allow", from_ip="any", dry_run=False)
    assert result["ok"]
    assert result["message"] == "Rule added"

def test_build_ufw_rule_deny_ssh(monkeypatch):
    monkeypatch.setattr(mod, "_run_cmd", lambda cmd: (0, "Rule added", ""))
    result = mod.execute(action="build_ufw_rule", port=22, proto="tcp", rule_op="deny", from_ip="any", dry_run=False)
    assert not result["ok"]
    assert "Cannot deny SSH port 22" in result["error"]
