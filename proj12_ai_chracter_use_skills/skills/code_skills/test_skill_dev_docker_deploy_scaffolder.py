import skill_dev_docker_deploy_scaffolder as mod
import pytest
from pathlib import Path

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "generate_dockerfile" in actions
    assert "generate_compose_yml" in actions
    assert "scaffold_docker_files" in actions

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action: unknown_action" in result["error"]

def test_generate_dockerfile(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        pass
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute(action="generate_dockerfile", lang="python", entry="app.py", port=8080, dry_run=True)
    assert result["ok"]
    assert "app.py" in result["dockerfile"]
    assert "8080" in result["dockerfile"]

def test_generate_compose_yml(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        pass
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute(action="generate_compose_yml", service_name="myapp", port=8080, env_file=".env", dry_run=True)
    assert result["ok"]
    assert "myapp" in result["docker_compose"]
    assert "8080" in result["docker_compose"]
    assert ".env" in result["docker_compose"]

def test_scaffold_docker_files(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        pass
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute(action="scaffold_docker_files", project_dir=str(tmp_path), lang="python", service_name="app", port=8080, dry_run=True)
    assert result["ok"]
    assert "app.py" in result["scaffolded_files"]["dockerfile"]
    assert "8080" in result["scaffolded_files"]["dockerfile"]
    assert "app" in result["scaffolded_files"]["docker_compose"]
    assert "8080" in result["scaffolded_files"]["docker_compose"]
    assert "app.py" not in result["scaffolded_files"]["dockerignore"]
