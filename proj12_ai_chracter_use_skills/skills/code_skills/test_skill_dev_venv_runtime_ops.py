import skill_dev_venv_runtime_ops as mod
import pytest
from unittest.mock import MagicMock
import os

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert set(actions) == {"check_dev_toolchains", "setup_project_venv", "install_in_venv"}

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_check_dev_toolchains(tmp_path, monkeypatch):
    monkeypatch.setattr(mod, "_which", lambda x: f"/path/to/{x}" if x in ["python", "node", "npm", "cargo", "git"] else None)
    result = mod.execute("check_dev_toolchains")
    assert result == {"ok": True, "results": {"python": True, "node": True, "npm": True, "cargo": True, "git": True}}

def test_setup_project_venv(tmp_path, monkeypatch):
    monkeypatch.setattr(mod, "_run_cmd", MagicMock())
    result = mod.execute("setup_project_venv", project_dir=str(tmp_path))
    assert result == {"ok": True, "message": f"Would create virtual environment at {tmp_path / '.venv'}"}

def test_install_in_venv(tmp_path, monkeypatch):
    venv_path = tmp_path / ".venv"
    venv_path.mkdir()
    pip_executable = venv_path / "Scripts" / "pip.exe" if os.name == 'nt' else venv_path / "bin" / "pip"
    pip_executable.parent.mkdir(parents=True)
    pip_executable.touch()
    monkeypatch.setattr(mod, "_run_cmd", MagicMock())
    result = mod.execute("install_in_venv", project_dir=str(tmp_path), packages=["requests"])
    assert result == {"ok": True, "message": f"Would install packages ['requests'] using ['{pip_executable}', 'requests']"}
