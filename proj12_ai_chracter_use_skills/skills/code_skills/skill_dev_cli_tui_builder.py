import os
import json
import argparse
import ast
import shutil
from pathlib import Path
from textwrap import wrap
from typing import List, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_dev_cli_tui_builder",
    "description": "Tạo công cụ dòng lệnh CLI TUI nhỏ gọn Python argparse hoặc Rust, định dạng bảng dữ liệu terminal căn cột đẹp xuất JSON CSV. Create compact CLI utilities with Python argparse, format tabular data into aligned plain-text CLI tables, and scaffold a compact CLI utility directory.",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["format_ascii_table", "generate_argparse_cli_py", "scaffold_cli_tool"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: List[str], cwd: str = None) -> str:
    import subprocess
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def format_ascii_table(headers: List[str], rows: List[List[str]]) -> str:
    if not rows:
        return ""

    # Determine the width of each column
    widths = [len(header) for header in headers]
    for row in rows:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(cell))

    # Create the header row
    header_row = " | ".join(header.ljust(width) for header, width in zip(headers, widths))
    separator = "-+-".join("-" * width for width in widths)

    # Create the data rows
    data_rows = [" | ".join(cell.ljust(width) for cell, width in zip(row, widths)) for row in rows]

    return "\n".join([header_row, separator] + data_rows)

def generate_argparse_cli_py(app_name: str, subcommands: List[Dict[str, Any]]) -> str:
    script = f"import argparse\n\nparser = argparse.ArgumentParser(description='{app_name}')\nsubparsers = parser.add_subparsers(dest='command')\n\n"

    for subcommand in subcommands:
        subparser = f"subparser_{subcommand['name']} = subparsers.add_parser('{subcommand['name']}', help='{subcommand['help']}')\n"
        for arg in subcommand.get('args', []):
            subparser += f"subparser_{subcommand['name']}.add_argument('{arg['name']}', help='{arg['help']}')\n"
        script += subparser

    script += "\ndef main():\n    args = parser.parse_args()\n    if args.command:\n        print(f'Command: {args.command}')\n        print(f'Args: {args}')\n\nif __name__ == '__main__':\n    main()\n"

    # Validate the generated script
    try:
        ast.parse(script)
    except SyntaxError as e:
        raise ValueError(f"Generated script has syntax errors: {e}")

    return script

def scaffold_cli_tool(project_dir: str, app_name: str, subcommands: List[Dict[str, Any]], dry_run: bool = True) -> Dict[str, Any]:
    project_path = Path(project_dir)
    if not dry_run:
        project_path.mkdir(parents=True, exist_ok=True)

    cli_script = generate_argparse_cli_py(app_name, subcommands)
    cli_script_path = project_path / f"{app_name}.py"
    if not dry_run:
        cli_script_path.write_text(cli_script)

    return {"ok": True, "message": f"Scaffolded CLI tool at {project_path}", "dry_run": dry_run}

def execute(action: str, **kwargs) -> Dict[str, Any]:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}

    if action == "format_ascii_table":
        headers = kwargs.get("headers", [])
        rows = kwargs.get("rows", [])
        return {"ok": True, "table": format_ascii_table(headers, rows)}

    if action == "generate_argparse_cli_py":
        app_name = kwargs.get("app_name", "")
        subcommands = kwargs.get("subcommands", [])
        return {"ok": True, "script": generate_argparse_cli_py(app_name, subcommands)}

    if action == "scaffold_cli_tool":
        project_dir = kwargs.get("project_dir", "")
        app_name = kwargs.get("app_name", "")
        subcommands = kwargs.get("subcommands", [])
        dry_run = kwargs.get("dry_run", True)
        return scaffold_cli_tool(project_dir, app_name, subcommands, dry_run)

    return {"ok": False, "error": "Invalid action"}
