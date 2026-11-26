import pytest
from unittest.mock import patch, MagicMock
from skill_docker_local_manager import execute, TOOL_SCHEMA

@patch('subprocess.run')
def test_list_containers(mock_run: MagicMock):
    mock_run.return_value.stdout = "CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS   PORTS     NAMES\n"
    result = execute(action="list_containers")
    assert result["ok"] is True
    assert "CONTAINER ID" in result["data"]

@patch('subprocess.run')
def test_list_images(mock_run: MagicMock):
    mock_run.return_value.stdout = "REPOSITORY   TAG       IMAGE ID       CREATED       SIZE\n"
    result = execute(action="list_images")
    assert result["ok"] is True
    assert "REPOSITORY" in result["data"]

@patch('subprocess.run')
def test_container_logs(mock_run: MagicMock):
    mock_run.return_value.stdout = "Log line 1\nLog line 2\n"
    result = execute(action="container_logs", container="test_container")
    assert result["ok"] is True
    assert "Log line 1" in result["data"]

@patch('subprocess.run')
def test_control_container_dry_run(mock_run: MagicMock):
    result = execute(action="control_container", container="test_container", op="restart", dry_run=True)
    assert result["ok"] is True
    assert "Preview: docker restart test_container" in result["data"]

@patch('subprocess.run')
def test_control_container(mock_run: MagicMock):
    mock_run.return_value.stdout = "test_container\n"
    result = execute(action="control_container", container="test_container", op="restart", dry_run=False)
    assert result["ok"] is True
    assert "test_container" in result["data"]

def test_unknown_action():
    result = execute(action="unknown_action")
    assert result["ok"] is False
    assert "Unknown action" in result["error"]

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_docker_local_manager"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA
    assert "action" in TOOL_SCHEMA["parameters"]["properties"]
    assert "enum" in TOOL_SCHEMA["parameters"]["properties"]["action"]
    assert "list_containers" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "list_images" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "container_logs" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "control_container" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
