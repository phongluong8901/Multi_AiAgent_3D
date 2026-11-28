import skill_dev_dep_env_manager as mod
import pytest
from pathlib import Path

def test_tool_schema():
    schema = mod.TOOL_SCHEMA
    assert schema["name"] == "skill_dev_dep_env_manager"
    assert "description" in schema
    assert schema["risk_level"] == "confirm"
    assert schema["parameters"]["properties"]["action"]["enum"] == ["detect_python_imports", "parse_manifest_deps", "build_install_plan"]

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_detect_python_imports(tmp_path):
    test_file = tmp_path / "test_file.py"
    test_file.write_text("import os, json, requests\nfrom httpx import Client")
    
    result = mod.execute(action="detect_python_imports", project_dir=str(tmp_path))
    assert result == {"ok": True, "third_party": ["httpx", "requests"]}

def test_parse_requirements_txt(tmp_path):
    requirements_file = tmp_path / "requirements.txt"
    requirements_file.write_text("requests\nhttpx\n# Comment\n")
    
    result = mod.execute(action="parse_manifest_deps", manifest_path=str(requirements_file))
    assert result == {"ok": True, "packages": ["requests", "httpx"]}

def test_build_install_plan(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        return ' '.join(cmd)
    
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    
    result = mod.execute(action="build_install_plan", project_dir=str(tmp_path), lang="python", packages=["requests", "httpx"])
    assert result == {"ok": True, "install_plan": ["pip install requests httpx"]}
