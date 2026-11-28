import os
import re
import ast
from pathlib import Path
from typing import List, Dict, Tuple

TOOL_SCHEMA = {
    "name": "skill_dev_code_search_grep",
    "description": "Pure-Python project-wide code search (`grep`/regex) ignoring `.git`, `node_modules`, `.venv`, `__pycache__`: return matching file paths, 1-based line numbers, and surrounding context lines, plus fast filename pattern search.",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["grep_text", "find_files_by_name", "find_symbol_refs"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: List[str], cwd: str = None) -> Tuple[int, str, str]:
    raise NotImplementedError("This function should be mocked in tests.")

def _is_binary_file(file_path: Path) -> bool:
    with open(file_path, 'rb') as f:
        return b'\x00' in f.read(1024)

def _search_in_file(file_path: Path, pattern: str, is_regex: bool, context_lines: int) -> List[Tuple[int, str]]:
    results = []
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
        if is_regex:
            regex = re.compile(pattern)
            for i, line in enumerate(lines, 1):
                if regex.search(line):
                    start = max(0, i - context_lines - 1)
                    end = min(len(lines), i + context_lines)
                    context = lines[start:end]
                    results.append((i, ''.join(context)))
        else:
            for i, line in enumerate(lines, 1):
                if pattern in line:
                    start = max(0, i - context_lines - 1)
                    end = min(len(lines), i + context_lines)
                    context = lines[start:end]
                    results.append((i, ''.join(context)))
    return results

def grep_text(root_dir: str, pattern: str, is_regex: bool = False, file_exts: List[str] = None, context_lines: int = 1, max_hits: int = 50) -> List[Dict]:
    root = Path(root_dir)
    hits = []
    for file_path in root.rglob('*'):
        if file_path.is_file() and not any(str(file_path).startswith(str(root / ignore)) for ignore in ['.git', 'node_modules', '.venv', '__pycache__']):
            if file_exts is None or file_path.suffix in file_exts:
                if not _is_binary_file(file_path):
                    file_hits = _search_in_file(file_path, pattern, is_regex, context_lines)
                    for line_number, context in file_hits:
                        hits.append({
                            "file_path": str(file_path),
                            "line_number": line_number,
                            "context": context
                        })
                        if len(hits) >= max_hits:
                            return hits
    return hits

def find_files_by_name(root_dir: str, name_substr: str, max_results: int = 50) -> List[str]:
    root = Path(root_dir)
    results = []
    for file_path in root.rglob(f'*{name_substr}*'):
        if file_path.is_file() and not any(str(file_path).startswith(str(root / ignore)) for ignore in ['.git', 'node_modules', '.venv', '__pycache__']):
            results.append(str(file_path))
            if len(results) >= max_results:
                return results
    return results

def find_symbol_refs(root_dir: str, symbol: str, max_hits: int = 50) -> List[Dict]:
    root = Path(root_dir)
    hits = []
    for file_path in root.rglob('*.py'):
        if file_path.is_file() and not any(str(file_path).startswith(str(root / ignore)) for ignore in ['.git', 'node_modules', '.venv', '__pycache__']):
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                tree = ast.parse(f.read())
                for node in ast.walk(tree):
                    if isinstance(node, (ast.FunctionDef, ast.ClassDef, ast.Assign)):
                        if isinstance(node, ast.Assign):
                            targets = [target.id for target in node.targets if isinstance(target, ast.Name)]
                        else:
                            targets = [node.name]
                        if symbol in targets:
                            hits.append({
                                "file_path": str(file_path),
                                "line_number": node.lineno,
                                "symbol": symbol
                            })
                            if len(hits) >= max_hits:
                                return hits
    return hits

def execute(action: str, **kwargs) -> Dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    if action == "grep_text":
        return {"ok": True, "results": grep_text(**kwargs)}
    elif action == "find_files_by_name":
        return {"ok": True, "results": find_files_by_name(**kwargs)}
    elif action == "find_symbol_refs":
        return {"ok": True, "results": find_symbol_refs(**kwargs)}
