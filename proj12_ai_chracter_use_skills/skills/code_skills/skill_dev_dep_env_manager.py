import os
import re
import ast
import json
import sys
import subprocess
from pathlib import Path

TOOL_SCHEMA = {
    "name": "skill_dev_dep_env_manager",
    "description": "Quản lý thư viện gói phụ thuộc Python Node Rust, quét import tìm gói thiếu, đọc requirements.txt package.json Cargo.toml và lập lệnh cài. Manage Python/Node/Rust dependencies, scan imports to find missing packages, parse requirements.txt/package.json/Cargo.toml and build safe install command plans.",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["detect_python_imports", "parse_manifest_deps", "build_install_plan"]},
        },
        "required": ["action"],
    },
}

STDLIB_MODULES = set(sys.stdlib_module_names)

def _run_cmd(cmd: list[str], cwd: str = None) -> str:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def detect_python_imports(project_dir: str) -> list[str]:
    third_party = set()
    local_modules = {f.stem for f in Path(project_dir).glob("*.py")}
    
    for py_file in Path(project_dir).glob("*.py"):
        with open(py_file, 'r', encoding='utf-8') as file:
            tree = ast.parse(file.read(), filename=str(py_file))
        
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    module_name = alias.name.split('.')[0]
                    if module_name not in STDLIB_MODULES and module_name not in local_modules:
                        third_party.add(module_name)
            elif isinstance(node, ast.ImportFrom):
                if node.level == 0:
                    module_name = node.module.split('.')[0]
                    if module_name not in STDLIB_MODULES and module_name not in local_modules:
                        third_party.add(module_name)
    
    return sorted(list(third_party))  # Sort the list to ensure consistent order

def parse_manifest_deps(manifest_path: str) -> list[str]:
    path = Path(manifest_path)
    if path.suffix == '.txt':
        with open(path, 'r', encoding='utf-8') as file:
            return [line.strip() for line in file if line.strip() and not line.startswith('#')]
    elif path.suffix == '.json':
        with open(path, 'r', encoding='utf-8') as file:
            data = json.load(file)
            return list(data.get('dependencies', {}).keys())
    elif path.suffix == '.toml':
        with open(path, 'r', encoding='utf-8') as file:
            content = file.read()
            return re.findall(r'^(\w+) =', content, re.MULTILINE)
    else:
        raise ValueError(f"Unsupported manifest file type: {path.suffix}")

def build_install_plan(project_dir: str, lang: str = 'python', packages: list[str] = None, dry_run: bool = True) -> list[str]:
    if packages is None:
        packages = []
    
    if lang == 'python':
        cmd = ['pip', 'install'] + packages
    elif lang == 'node':
        cmd = ['npm', 'install'] + packages
    elif lang == 'rust':
        cmd = ['cargo', 'add'] + packages
    else:
        raise ValueError(f"Unsupported language: {lang}")
    
    if dry_run:
        return [' '.join(cmd)]
    else:
        _run_cmd(cmd, cwd=project_dir)
        return []

def execute(action: str = "detect_python_imports", **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    try:
        if action == "detect_python_imports":
            project_dir = kwargs.get("project_dir")
            if not project_dir:
                return {"ok": False, "error": "Missing project_dir"}
            third_party = detect_python_imports(project_dir)
            return {"ok": True, "third_party": third_party}
        elif action == "parse_manifest_deps":
            manifest_path = kwargs.get("manifest_path")
            if not manifest_path:
                return {"ok": False, "error": "Missing manifest_path"}
            packages = parse_manifest_deps(manifest_path)
            return {"ok": True, "packages": packages}
        elif action == "build_install_plan":
            project_dir = kwargs.get("project_dir")
            lang = kwargs.get("lang", "python")
            packages = kwargs.get("packages", [])
            dry_run = kwargs.get("dry_run", True)
            if not project_dir:
                return {"ok": False, "error": "Missing project_dir"}
            install_plan = build_install_plan(project_dir, lang, packages, dry_run)
            return {"ok": True, "install_plan": install_plan}
    except Exception as e:
        return {"ok": False, "error": str(e)}

    return {"ok": False, "error": "Unexpected error"}
