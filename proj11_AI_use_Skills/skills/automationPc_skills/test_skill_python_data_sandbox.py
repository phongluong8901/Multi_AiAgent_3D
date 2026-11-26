import pytest
from skill_python_data_sandbox import execute, validate_code_safety, analyze_csv_summary, run_safe_script

def test_tool_schema():
    schema = execute()
    assert schema["ok"] is False
    assert "error" in schema

def test_unknown_action():
    result = execute(action="unknown")
    assert result["ok"] is False
    assert result["error"] == "Unknown action"

def test_validate_code_safety():
    safe_code = "print('Hello, World!')"
    unsafe_code = "os.system('rm -rf /')"
    assert validate_code_safety(safe_code)["ok"] is True
    assert validate_code_safety(unsafe_code)["ok"] is False

def test_analyze_csv_summary(tmp_path):
    csv_content = "name,age,salary\nAlice,30,50000\nBob,25,45000\nCharlie,35,60000"
    csv_path = tmp_path / "test.csv"
    csv_path.write_text(csv_content)
    result = analyze_csv_summary(str(csv_path), group_by="age", value_col="salary")
    assert result["ok"] is True
    assert len(result["summary"]) == 3

def test_run_safe_script(monkeypatch):
    safe_code = "print('Hello, World!')"
    unsafe_code = "os.system('rm -rf /')"
    result = run_safe_script(safe_code, dry_run=True)
    assert result["ok"] is True
    assert result["message"] == "Dry run completed"
    result = run_safe_script(unsafe_code, dry_run=True)
    assert result["ok"] is False
    assert "Forbidden function" in result["error"]
