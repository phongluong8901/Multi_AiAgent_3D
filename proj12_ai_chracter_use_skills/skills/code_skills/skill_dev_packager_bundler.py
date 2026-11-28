import os
import subprocess
import json
import pathlib
import shutil

TOOL_SCHEMA = {
    "name": "skill_dev_packager_bundler",
    "description": "Build packaging plans for Python (PyInstaller), Rust (cargo build --release), or Node.js apps, generate cross-platform build scripts (dry_run=True default), and audit generated artifacts/sizes in a dist directory.",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["build_package_plan", "generate_build_script", "audit_release_artifacts"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str = None) -> str:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def build_package_plan(project_dir: str, lang: str = 'python', entry_file: str = 'main.py', onefile: bool = True, dry_run: bool = True) -> dict:
    if lang == 'python':
        cmd = ['pyinstaller', '--onefile', entry_file] if onefile else ['pyinstaller', entry_file]
    elif lang == 'rust':
        cmd = ['cargo', 'build', '--release']
    elif lang == 'node':
        cmd = ['npm', 'install'] + (['--production'] if not onefile else [])
    else:
        return {"ok": False, "error": f"Unsupported language: {lang}"}
    
    if not dry_run:
        _run_cmd(cmd, cwd=project_dir)
    
    return {"ok": True, "cmd": ' '.join(cmd)}

def generate_build_script(project_dir: str, lang: str = 'python', target_os: str = 'windows', dry_run: bool = True) -> dict:
    script_content = ""
    if lang == 'python':
        script_content = "pyinstaller --onefile main.py" if target_os == 'windows' else "pyinstaller main.py"
    elif lang == 'rust':
        script_content = "cargo build --release"
    elif lang == 'node':
        script_content = "npm install --production" if target_os == 'windows' else "npm install --production"
    else:
        return {"ok": False, "error": f"Unsupported language: {lang}"}
    
    script_path = os.path.join(project_dir, f"build_{lang}.sh" if target_os != 'windows' else f"build_{lang}.bat")
    if not dry_run:
        with open(script_path, 'w') as script_file:
            script_file.write(script_content)
    
    return {"ok": True, "script_path": script_path}

def audit_release_artifacts(dist_dir: str) -> dict:
    if not os.path.exists(dist_dir):
        return {"ok": False, "error": f"Directory {dist_dir} does not exist"}
    
    artifacts = []
    for root, _, files in os.walk(dist_dir):
        for file in files:
            file_path = os.path.join(root, file)
            file_size = os.path.getsize(file_path)
            artifacts.append({"name": file, "path": file_path, "size": file_size})
    
    return {"ok": True, "artifacts": artifacts}

def execute(action: str, **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    if action == "build_package_plan":
        return build_package_plan(**kwargs)
    elif action == "generate_build_script":
        return generate_build_script(**kwargs)
    elif action == "audit_release_artifacts":
        return audit_release_artifacts(**kwargs)
