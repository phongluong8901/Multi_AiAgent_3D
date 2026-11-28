import os
import json
import shutil
from pathlib import Path
from typing import List, Optional, Dict

TOOL_SCHEMA = {
    "name": "skill_dev_python_tool_scaffolder",
    "description": "Tạo nhanh tool Python nhỏ gọn CLI tray API, sinh file pyproject.toml và mã gọi ngược vào các kho skill AutoEvolve. Quickly scaffold compact standalone Python tools (cli, daemon, api_worker) with clean entrypoints (dry_run=True default), generate pyproject.toml text, and produce a helper stub module that imports and invokes existing AutoEvolve skills.",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["scaffold_python_tool", "generate_pyproject_toml", "generate_skill_caller_stub"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: List[str], cwd: Optional[str] = None) -> str:
    import subprocess
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def _write_file(file_path: Path, content: str) -> None:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content)

def generate_pyproject_toml(tool_name: str, deps: Optional[List[str]] = None) -> str:
    deps = deps or []
    pyproject_content = f"""[build-system]
requires = ["setuptools", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "{tool_name}"
version = "0.1.0"
description = "A compact Python tool"
authors = [
    {{ name = "Your Name", email = "your.email@example.com" }}
]
dependencies = {json.dumps(deps)}

[project.scripts]
{tool_name} = "{tool_name}:main"
"""
    return pyproject_content

def generate_skill_caller_stub(skill_paths: List[str]) -> str:
    import ast
    import difflib

    stub_content = "def call_skills():\n"
    for skill_path in skill_paths:
        skill_name = Path(skill_path).stem
        stub_content += f"    from {skill_name} import execute as {skill_name}_execute\n"
        stub_content += f"    {skill_name}_execute()\n"
    return stub_content

def scaffold_python_tool(project_dir: str, tool_name: str, template: str = 'cli', deps: Optional[List[str]] = None, dry_run: bool = True) -> Dict[str, bool]:
    project_path = Path(project_dir) / tool_name
    if dry_run:
        print(f"Dry run: Creating project structure at {project_path}")
    else:
        project_path.mkdir(parents=True, exist_ok=True)

    pyproject_content = generate_pyproject_toml(tool_name, deps)
    pyproject_path = project_path / "pyproject.toml"
    if dry_run:
        print(f"Dry run: Writing pyproject.toml to {pyproject_path}")
    else:
        _write_file(pyproject_path, pyproject_content)

    main_content = f"""def main():
    print("Hello from {tool_name}!")

if __name__ == "__main__":
    main()
"""
    main_path = project_path / f"{tool_name}.py"
    if dry_run:
        print(f"Dry run: Writing {tool_name}.py to {main_path}")
    else:
        _write_file(main_path, main_content)

    if template == 'cli':
        pass  # CLI template is already handled
    elif template == 'daemon':
        daemon_content = """import time

def run_daemon():
    while True:
        print("Daemon is running...")
        time.sleep(10)

if __name__ == "__main__":
    run_daemon()
"""
        daemon_path = project_path / f"{tool_name}_daemon.py"
        if dry_run:
            print(f"Dry run: Writing {tool_name}_daemon.py to {daemon_path}")
        else:
            _write_file(daemon_path, daemon_content)
    elif template == 'api_worker':
        api_worker_content = """def process_api_request(request):
    print(f"Processing request: {request}")

if __name__ == "__main__":
    import sys
    process_api_request(sys.argv[1])
"""
        api_worker_path = project_path / f"{tool_name}_api_worker.py"
        if dry_run:
            print(f"Dry run: Writing {tool_name}_api_worker.py to {api_worker_path}")
        else:
            _write_file(api_worker_path, api_worker_content)
    else:
        return {"ok": False, "error": f"Unknown template: {template}"}

    return {"ok": True}

def execute(action: str, **kwargs) -> Dict[str, bool]:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}

    if action == "scaffold_python_tool":
        return scaffold_python_tool(**kwargs)
    elif action == "generate_pyproject_toml":
        pyproject_content = generate_pyproject_toml(**kwargs)
        return {"ok": True, "pyproject_content": pyproject_content}
    elif action == "generate_skill_caller_stub":
        stub_content = generate_skill_caller_stub(**kwargs)
        return {"ok": True, "stub_content": stub_content}
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
