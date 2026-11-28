import skill_dev_e2e_smoke_verifier as mod
import pytest
from unittest.mock import MagicMock

def test_tool_schema():
    schema = mod.TOOL_SCHEMA
    assert schema["name"] == "skill_dev_e2e_smoke_verifier"
    assert schema["risk_level"] == "safe"
    assert schema["parameters"]["properties"]["action"]["enum"] == ["verify_http_contract", "verify_cli_smoke", "run_verification_suite"]

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_verify_http_contract(tmp_path, monkeypatch):
    mock_http_get = MagicMock(return_value=(200, '{"key": "value"}'))
    monkeypatch.setattr(mod, "_http_get", mock_http_get)

    result = mod.execute("verify_http_contract", url="http://example.com", required_json_keys=["key"])
    assert result == {"ok": True}

def test_verify_cli_smoke(tmp_path, monkeypatch):
    mock_run_cmd = MagicMock(return_value=(0, "expected output", ""))
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)

    result = mod.execute("verify_cli_smoke", cmd=["echo", "expected output"], must_contain="expected output")
    assert result == {"ok": True}

def test_run_verification_suite(tmp_path, monkeypatch):
    mock_http_get = MagicMock(return_value=(200, '{"key": "value"}'))
    mock_run_cmd = MagicMock(return_value=(0, "expected output", ""))
    monkeypatch.setattr(mod, "_http_get", mock_http_get)
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)

    checks = [
        {"action": "verify_http_contract", "params": {"url": "http://example.com", "required_json_keys": ["key"]}},
        {"action": "verify_cli_smoke", "params": {"cmd": ["echo", "expected output"], "must_contain": "expected output"}}
    ]

    result = mod.execute("run_verification_suite", checks=checks)
    assert result == {"ok": True, "results": [{"ok": True}, {"ok": True}]}
