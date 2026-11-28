import pytest
from unittest.mock import patch, MagicMock
from skill_dev_workspace_helper import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_dev_workspace_helper"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA
    assert "action" in TOOL_SCHEMA["parameters"]["properties"]
    assert "repo_path" in TOOL_SCHEMA["parameters"]["properties"]
    assert "limit" in TOOL_SCHEMA["parameters"]["properties"]
    assert "path" in TOOL_SCHEMA["parameters"]["properties"]
    assert "output" in TOOL_SCHEMA["parameters"]["properties"]
    assert "dry_run" in TOOL_SCHEMA["parameters"]["properties"]

@patch('subprocess.run')
def test_git_status(mock_run):
    mock_run.return_value = MagicMock(stdout="On branch main\nnothing to commit, working tree clean\n")
    result = execute("git_status", repo_path=".", dry_run=False)
    assert result["ok"] is True
    assert "On branch main" in result["output"]

@patch('subprocess.run')
def test_git_status_dry_run(mock_run):
    result = execute("git_status", repo_path=".", dry_run=True)
    assert result["ok"] is True
    assert result["preview"] == "Would run git status in ."
    mock_run.assert_not_called()

@patch('subprocess.run')
def test_git_recent_log(mock_run):
    mock_run.return_value = MagicMock(stdout="commit1\ncommit2\n")
    result = execute("git_recent_log", repo_path=".", limit=2, dry_run=False)
    assert result["ok"] is True
    assert "commit1" in result["output"]
    assert "commit2" in result["output"]

@patch('subprocess.run')
def test_git_recent_log_dry_run(mock_run):
    result = execute("git_recent_log", repo_path=".", limit=2, dry_run=True)
    assert result["ok"] is True
    assert result["preview"] == "Would run git log in . with limit 2"
    mock_run.assert_not_called()

@patch('subprocess.run')
def test_open_in_vscode(mock_run):
    result = execute("open_in_vscode", path=".", dry_run=False)
    assert result["ok"] is True
    assert result["message"] == "Opened . in VS Code"
    mock_run.assert_called_once_with(["code", "."], check=True)

@patch('subprocess.run')
def test_open_in_vscode_dry_run(mock_run):
    result = execute("open_in_vscode", path=".", dry_run=True)
    assert result["ok"] is True
    assert result["preview"] == "Would open . in VS Code"
    mock_run.assert_not_called()

def test_parse_git_status_porcelain():
    output = " M file1.txt\n?? file2.txt"
    result = execute("parse_git_status_porcelain", output=output, dry_run=False)
    assert result["ok"] is True
    assert result["changes"] == [{"status": " M", "file": "file1.txt"}, {"status": "??", "file": "file2.txt"}]

def test_parse_git_status_porcelain_dry_run():
    output = " M file1.txt\n?? file2.txt"
    result = execute("parse_git_status_porcelain", output=output, dry_run=True)
    assert result["ok"] is True
    assert result["preview"] == f"Would parse git status porcelain output: {output}"
