import os
import pytest
import skill_linux_env_secret_vault_ops as mod
from pathlib import Path

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_env_secret_vault_ops"
    assert mod.TOOL_SCHEMA["risk_level"] == "confirm"
    assert "action" in mod.TOOL_SCHEMA["parameters"]["properties"]
    assert set(mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]) == {"parse_env_file", "upsert_env_vars", "audit_env_security"}

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action"}

def test_parse_env_file(tmp_path):
    env_path = tmp_path / ".env"
    env_path.write_text("API_KEY=123456\nPASSWORD=abcdef\nNORMAL_VAR=normal")
    result = mod.parse_env_file(env_path=str(env_path), mask_secrets=True)
    assert result["ok"]
    assert result["env_vars"] == {"API_KEY": "12***56", "PASSWORD": "ab***ef", "NORMAL_VAR": "normal"}

def test_upsert_env_vars(tmp_path):
    env_path = tmp_path / ".env"
    env_path.write_text("API_KEY=123456\nPASSWORD=abcdef")
    result = mod.upsert_env_vars(env_path=str(env_path), updates={"API_KEY": "new_key", "NEW_VAR": "new_value"}, dry_run=True)
    assert result["ok"]
    assert result["env_vars"] == {"API_KEY": "new_key", "PASSWORD": "abcdef", "NEW_VAR": "new_value"}
    assert env_path.read_text() == "API_KEY=123456\nPASSWORD=abcdef"

def test_audit_env_security(tmp_path, monkeypatch):
    env_path = tmp_path / ".env"
    env_path.write_text("API_KEY=123456\nPASSWORD=abcdef", encoding="utf-8")
    os.chmod(env_path, 0o600)
    result = mod.audit_env_security(env_path=str(env_path), required_keys=["API_KEY", "PASSWORD"])
    assert result["ok"]

    os.chmod(env_path, 0o644)
    if os.name == "nt":
        real_stat = os.stat
        class _MockStat:
            st_mode = 0o100644
        monkeypatch.setattr(os, "stat", lambda p, *a, **kw: _MockStat() if str(p) == str(env_path) else real_stat(p, *a, **kw))
    result = mod.audit_env_security(env_path=str(env_path), required_keys=["API_KEY", "PASSWORD"])
    assert result == {"ok": False, "error": "Incorrect file permissions: 644, expected 600"}

    result = mod.audit_env_security(env_path=str(env_path), required_keys=["API_KEY", "MISSING_KEY"])
    assert result == {"ok": False, "error": "Missing required keys: MISSING_KEY"}
