import skill_dev_code_security_auditor as mod
import pytest
from pathlib import Path

def test_tool_schema():
    schema = mod.TOOL_SCHEMA
    assert schema["name"] == "skill_dev_code_security_auditor"
    assert schema["risk_level"] == "safe"
    assert schema["parameters"]["properties"]["action"]["enum"] == ["scan_hardcoded_secrets", "audit_python_dangerous_calls", "check_function_complexity"]

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_scan_hardcoded_secrets(tmp_path):
    test_file = tmp_path / "test_file.py"
    test_file.write_text('API_KEY = "dummy_secret_value_12345"\nsk_test_1234567890abcdef123456')
    result = mod.execute(action="scan_hardcoded_secrets", root_dir=str(tmp_path))
    assert result["ok"] is True
    assert str(test_file) in result["results"]

def test_audit_python_dangerous_calls(tmp_path):
    test_file = tmp_path / "test_file.py"
    test_file.write_text('eval("1+1")\nexec("print(2+2)")\nimport subprocess\nsubprocess.run("ls", shell=True)')
    result = mod.execute(action="audit_python_dangerous_calls", file_path=str(test_file))
    assert result["ok"] is True
    assert len(result["results"]) == 3

def test_check_function_complexity(tmp_path):
    test_file = tmp_path / "test_file.py"
    test_file.write_text('def long_function():\n' + '    pass\n' * 61)
    result = mod.execute(action="check_function_complexity", file_path=str(test_file), max_lines=60)
    assert result["ok"] is True
    assert len(result["results"]) == 1
    assert "long_function" in result["results"][0]
