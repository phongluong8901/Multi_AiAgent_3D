import os
import re
import subprocess
from pathlib import Path

TOOL_SCHEMA = {
    "name": "skill_dev_doc_readme_builder",
    "description": "Tự động tạo tài liệu README.md cho tool vừa đẻ, trích xuất thông tin dự án Python Node Rust và hướng dẫn cài đặt sử dụng. Automatically generate README.md for newly born tools, extract project information for Python, Node, Rust, and provide setup/usage instructions.",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["extract_project_meta", "render_readme_md", "write_readme_file"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str = None) -> str:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout.strip()

def extract_project_meta(project_dir: str) -> dict:
    project_path = Path(project_dir)
    meta = {
        "project_name": project_path.name,
        "lang": "unknown",
        "entry_files": [],
        "commands": []
    }

    if (project_path / "setup.py").exists():
        meta["lang"] = "python"
        meta["entry_files"].append("setup.py")
        meta["commands"] = ["pip install .", "python -m <module_name>"]
    elif (project_path / "package.json").exists():
        meta["lang"] = "node"
        meta["entry_files"].append("package.json")
        meta["commands"] = ["npm install", "node <entry_file>"]
    elif (project_path / "Cargo.toml").exists():
        meta["lang"] = "rust"
        meta["entry_files"].append("Cargo.toml")
        meta["commands"] = ["cargo build", "cargo run"]

    return meta

def render_readme_md(project_name: str, description: str, lang: str = 'python', commands: list[str] = None) -> str:
    if commands is None:
        commands = []

    setup_commands = "\n".join(f"- `{cmd}`" for cmd in commands)
    usage_commands = "\n".join(f"- `{cmd}`" for cmd in commands)

    readme_content = f"""# {project_name}

{description}

## Setup

{setup_commands}

## Usage

{usage_commands}
"""
    return readme_content

def write_readme_file(project_dir: str, content: str, dry_run: bool = True) -> dict:
    project_path = Path(project_dir)
    readme_path = project_path / "README.md"

    if dry_run:
        return {"ok": True, "message": "Dry run: README.md would be written to disk."}

    with readme_path.open("w") as f:
        f.write(content)

    return {"ok": True, "message": "README.md written to disk."}

def execute(action: str, **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}

    if action == "extract_project_meta":
        return extract_project_meta(**kwargs)
    elif action == "render_readme_md":
        return {"ok": True, "content": render_readme_md(**kwargs)}
    elif action == "write_readme_file":
        return write_readme_file(**kwargs)
