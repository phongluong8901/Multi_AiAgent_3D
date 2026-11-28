import pytest
from unittest.mock import patch, MagicMock
from skill_winget_app_installer import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_winget_app_installer"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA
    assert "action" in TOOL_SCHEMA["parameters"]["properties"]
    assert "query" in TOOL_SCHEMA["parameters"]["properties"]
    assert "package_id" in TOOL_SCHEMA["parameters"]["properties"]
    assert "dry_run" in TOOL_SCHEMA["parameters"]["properties"]

@patch("subprocess.run")
def test_search_package_dry_run(mock_run: MagicMock):
    mock_run.return_value = MagicMock(stdout="Mocked search results", stderr="", returncode=0)
    result = execute(action="search_package", query="example", dry_run=True)
    assert result["ok"] is True
    assert "preview" in result
    assert result["preview"] == "Mocked search results"

@patch("subprocess.run")
def test_search_package_no_dry_run(mock_run: MagicMock):
    mock_run.return_value = MagicMock(stdout="Mocked search results", stderr="", returncode=0)
    result = execute(action="search_package", query="example", dry_run=False)
    assert result["ok"] is True
    assert "result" in result
    assert result["result"] == "Mocked search results"

@patch("subprocess.run")
def test_list_upgrades_dry_run(mock_run: MagicMock):
    mock_run.return_value = MagicMock(stdout="Mocked upgrade list", stderr="", returncode=0)
    result = execute(action="list_upgrades", dry_run=True)
    assert result["ok"] is True
    assert "preview" in result
    assert result["preview"] == "Mocked upgrade list"

@patch("subprocess.run")
def test_list_upgrades_no_dry_run(mock_run: MagicMock):
    mock_run.return_value = MagicMock(stdout="Mocked upgrade list", stderr="", returncode=0)
    result = execute(action="list_upgrades", dry_run=False)
    assert result["ok"] is True
    assert "result" in result
    assert result["result"] == "Mocked upgrade list"

@patch("subprocess.run")
def test_build_install_cmd_dry_run(mock_run: MagicMock):
    mock_run.return_value = MagicMock(stdout="Mocked install command", stderr="", returncode=0)
    result = execute(action="build_install_cmd", package_id="example.package", dry_run=True)
    assert result["ok"] is True
    assert "preview" in result
    assert result["preview"] == "winget install example.package"

@patch("subprocess.run")
def test_build_install_cmd_no_dry_run(mock_run: MagicMock):
    mock_run.return_value = MagicMock(stdout="Mocked install command", stderr="", returncode=0)
    result = execute(action="build_install_cmd", package_id="example.package", dry_run=False)
    assert result["ok"] is True
    assert "result" in result
    assert result["result"] == "Mocked install command"

def test_unknown_action():
    result = execute(action="unknown_action")
    assert result["ok"] is False
    assert "error" in result
    assert result["error"] == "Unknown action: unknown_action"
