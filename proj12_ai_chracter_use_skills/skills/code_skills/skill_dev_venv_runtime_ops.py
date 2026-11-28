import os
import subprocess
import json
import pathlib
import shutil

TOOL_SCHEMA = {
    "name": "skill_dev_venv_runtime_ops",
    "description": "Inspect available local developer runtimes (Python, Node, Cargo, Git) via mockable _which/_run_cmd, plan or create isolated .venv environments inside a project folder, and build/run isolated pip/npm/cargo install commands (dry_run=True default). Kiểm tra môi trường cài đặt Python Node Cargo trên máy, tạo môi trường ảo .venv cô lập cho từng mini app và cài gói phụ thuộc an toàn",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["check_dev_toolchains", "setup_project_venv", "install_in_venv"]},
        },
        "required": ["action"],
    },
}

def _which(binary: str) -> str:
    """Locate a binary in the PATH."""
    return shutil.which(binary)

def _run_cmd(cmd: list[str], cwd: str = None) -> subprocess.CompletedProcess:
    """Run a command and return the completed process."""
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)

def check_dev_toolchains(tools: list[str] = None) -> dict:
    """Check available local developer runtimes."""
    tools = tools or ["python", "node", "npm", "cargo", "git"]
    results = {tool: _which(tool) is not None for tool in tools}
    return {"ok": True, "results": results}

def setup_project_venv(project_dir: str, venv_name: str = '.venv', dry_run: bool = True) -> dict:
    """Plan or create isolated .venv environments inside a project folder."""
    project_path = pathlib.Path(project_dir)
    venv_path = project_path / venv_name

    if venv_path.exists():
        return {"ok": True, "message": f"Virtual environment already exists at {venv_path}"}

    if dry_run:
        return {"ok": True, "message": f"Would create virtual environment at {venv_path}"}

    if _which("python") is None:
        return {"ok": False, "error": "Python is not installed"}

    _run_cmd([_which("python"), "-m", "venv", str(venv_path)], cwd=project_dir)
    return {"ok": True, "message": f"Created virtual environment at {venv_path}"}

def install_in_venv(project_dir: str, packages: list[str], venv_name: str = '.venv', dry_run: bool = True) -> dict:
    """Build/run isolated pip/npm/cargo install commands."""
    project_path = pathlib.Path(project_dir)
    venv_path = project_path / venv_name

    if not venv_path.exists():
        return {"ok": False, "error": f"Virtual environment does not exist at {venv_path}"}

    if _which("python") is None:
        return {"ok": False, "error": "Python is not installed"}

    pip_executable = venv_path / "Scripts" / "pip.exe" if os.name == 'nt' else venv_path / "bin" / "pip"
    if not pip_executable.exists():
        return {"ok": False, "error": f"Pip executable not found at {pip_executable}"}

    install_cmd = [str(pip_executable)] + packages
    if dry_run:
        return {"ok": True, "message": f"Would install packages {packages} using {install_cmd}"}

    _run_cmd(install_cmd, cwd=project_dir)
    return {"ok": True, "message": f"Installed packages {packages} using {install_cmd}"}

def execute(action: str = "check_dev_toolchains", **kwargs) -> dict:
    """Execute the specified action."""
    if action == "check_dev_toolchains":
        return check_dev_toolchains(**kwargs)
    elif action == "setup_project_venv":
        return setup_project_venv(**kwargs)
    elif action == "install_in_venv":
        return install_in_venv(**kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
