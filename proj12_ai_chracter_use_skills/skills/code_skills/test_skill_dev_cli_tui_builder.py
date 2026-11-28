import pytest
import skill_dev_cli_tui_builder as mod
from pathlib import Path

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert set(actions) == {"format_ascii_table", "generate_argparse_cli_py", "scaffold_cli_tool"}

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_format_ascii_table(tmp_path):
    headers = ["Name", "Age", "City"]
    rows = [["Alice", "30", "New York"], ["Bob", "25", "Los Angeles"]]
    result = mod.execute("format_ascii_table", headers=headers, rows=rows)
    expected = "Name  | Age | City       \n------+-----+------------\nAlice | 30  | New York   \nBob   | 25  | Los Angeles"
    assert result == {"ok": True, "table": expected}

def test_generate_argparse_cli_py(tmp_path):
    app_name = "test_app"
    subcommands = [
        {"name": "greet", "help": "Greet the user", "args": [{"name": "--name", "help": "Name of the user"}]},
        {"name": "farewell", "help": "Say farewell", "args": [{"name": "--name", "help": "Name of the user"}]}
    ]
    result = mod.execute("generate_argparse_cli_py", app_name=app_name, subcommands=subcommands)
    assert result["ok"]
    assert "import argparse" in result["script"]
    assert "subparser_greet = subparsers.add_parser('greet', help='Greet the user')" in result["script"]
    assert "subparser_greet.add_argument('--name', help='Name of the user')" in result["script"]

def test_scaffold_cli_tool(tmp_path, monkeypatch):
    app_name = "test_app"
    subcommands = [
        {"name": "greet", "help": "Greet the user", "args": [{"name": "--name", "help": "Name of the user"}]},
        {"name": "farewell", "help": "Say farewell", "args": [{"name": "--name", "help": "Name of the user"}]}
    ]
    project_dir = str(tmp_path / "test_project")

    def mock_run_cmd(cmd, cwd=None):
        return ""

    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute("scaffold_cli_tool", project_dir=project_dir, app_name=app_name, subcommands=subcommands, dry_run=False)
    assert result == {"ok": True, "message": f"Scaffolded CLI tool at {Path(project_dir)}", "dry_run": False}
    assert (Path(project_dir) / f"{app_name}.py").exists()
