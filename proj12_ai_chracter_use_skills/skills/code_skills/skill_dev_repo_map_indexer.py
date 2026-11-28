import os
import re
import ast
import json
from pathlib import Path

TOOL_SCHEMA = {
    "name": "skill_dev_repo_map_indexer",
    "description": "Index a local code repository into a compact LLM-friendly repo map: build a depth-limited directory tree ignoring .git/node_modules/__pycache__, extract Python functions/classes via ast, and summarize symbols across files.",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["build_tree", "extract_python_symbols", "build_repo_map"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str = None):
    # Placeholder for running shell commands
    pass

def build_tree(root_dir: str, max_depth: int = 3, ignore_dirs: list[str] = None):
    ignore_dirs = ignore_dirs or ['.git', 'node_modules', '__pycache__']
    root_path = Path(root_dir)
    tree = {}

    def _build_tree(path: Path, depth: int):
        if depth > max_depth:
            return
        if path.name in ignore_dirs:
            return
        if path.is_dir():
            tree[path.name] = {}
            for child in path.iterdir():
                _build_tree(child, depth + 1)
        else:
            tree[path.name] = None

    _build_tree(root_path, 0)
    return tree

def extract_python_symbols(file_path: str):
    with open(file_path, 'r', encoding='utf-8') as file:
        tree = ast.parse(file.read())
    symbols = []
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            symbols.append(node.name)
        elif isinstance(node, ast.ClassDef):
            symbols.append(node.name)
    return symbols

def build_repo_map(root_dir: str, max_files: int = 40):
    tree = build_tree(root_dir, max_depth=3)
    repo_map = {'files': {}, 'symbols': {}}
    file_count = 0

    def _process_files(path: Path):
        nonlocal file_count
        if file_count >= max_files:
            return
        if path.is_dir():
            for child in path.iterdir():
                _process_files(child)
        else:
            if path.suffix == '.py':
                repo_map['files'][str(path.relative_to(root_dir))] = extract_python_symbols(str(path))
                file_count += 1

    _process_files(Path(root_dir))
    return repo_map

def execute(action: str, **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}

    if action == "build_tree":
        return {"ok": True, "result": build_tree(**kwargs)}
    elif action == "extract_python_symbols":
        return {"ok": True, "result": extract_python_symbols(**kwargs)}
    elif action == "build_repo_map":
        return {"ok": True, "result": build_repo_map(**kwargs)}
