import pytest
from skill_python_venv_manager import execute, _run_cmd, TOOL_SCHEMA

def test_tool_schema():
    assert isinstance(TOOL_SCHEMA, dict)
    assert TOOL_SCHEMA["name"] == "skill_python_venv_manager"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "parameters" in TOOL_SCHEMA

def test_unknown_action():
    result = execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_find_venvs(tmp_path, monkeypatch):
    venv_path = tmp_path / "venv"
    venv_path.mkdir()
    (venv_path / "Scripts").mkdir()
    (venv_path / "Lib").mkdir()

    def mock_find_venvs(root):
        return [str(venv_path)]

    monkeypatch.setattr("skill_python_venv_manager.find_venvs", mock_find_venvs)
    result = execute(action="find_venvs", root=str(tmp_path))
    assert result["ok"]
    assert len(result["venvs"]) == 1
    assert result["venvs"][0] == str(venv_path)

def test_list_installed_packages(monkeypatch):
    mock_output = "package1==1.0.0\npackage2==2.0.0"
    monkeypatch.setattr("skill_python_venv_manager._run_cmd", lambda cmd: mock_output)
    result = execute(action="list_installed_packages", limit=1)
    assert result["ok"]
    assert len(result["packages"]) == 1
    assert result["packages"][0] == "package1==1.0.0"

def test_parse_requirements(tmp_path):
    requirements_path = tmp_path / "requirements.txt"
    requirements_path.write_text("package1==1.0.0\n# Comment\npackage2==2.0.0\n")

    result = execute(action="parse_requirements", file_path=str(requirements_path))
    assert result["ok"]
    assert len(result["requirements"]) == 2
    assert "package1==1.0.0" in result["requirements"]
    assert "package2==2.0.0" in result["requirements"]
