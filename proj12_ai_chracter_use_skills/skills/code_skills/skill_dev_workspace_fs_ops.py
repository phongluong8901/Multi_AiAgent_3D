import os
import pathlib

TOOL_SCHEMA = {
    "name": "skill_dev_workspace_fs_ops",
    "description": "Safe sandboxed workspace file primitives for coding agents: read file slices with line numbers, create/overwrite files atomically strictly inside workspace_root (rejecting path traversal like '..'), and list/delete workspace files (dry_run=True default for write/delete).",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["read_file_lines", "write_file_safe", "delete_file_safe", "list_workspace_files"]},
            "workspace_root": {"type": "string"},
            "rel_path": {"type": "string"},
            "start_line": {"type": "integer", "minimum": 1},
            "end_line": {"type": "integer", "minimum": 1},
            "content": {"type": "string"},
            "dry_run": {"type": "boolean"},
            "max_files": {"type": "integer", "minimum": 1},
        },
        "required": ["action", "workspace_root"],
    },
}

def _is_safe_path(workspace_root: str, rel_path: str) -> bool:
    full_path = os.path.realpath(os.path.join(workspace_root, rel_path))
    return full_path.startswith(os.path.realpath(workspace_root))

def read_file_lines(workspace_root: str, rel_path: str, start_line: int = 1, end_line: int = 120) -> dict:
    if not _is_safe_path(workspace_root, rel_path):
        return {'ok': False, 'error': 'Path traversal blocked'}
    
    file_path = os.path.join(workspace_root, rel_path)
    if not os.path.isfile(file_path):
        return {'ok': False, 'error': 'File not found'}
    
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            lines = file.readlines()
            return {'ok': True, 'content': lines[start_line-1:end_line]}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

def write_file_safe(workspace_root: str, rel_path: str, content: str, dry_run: bool = True) -> dict:
    if not _is_safe_path(workspace_root, rel_path):
        return {'ok': False, 'error': 'Path traversal blocked'}
    
    file_path = os.path.join(workspace_root, rel_path)
    if dry_run:
        return {'ok': True, 'message': 'Dry run: file would be written'}
    
    try:
        with open(file_path, 'w', encoding='utf-8') as file:
            file.write(content)
        return {'ok': True, 'message': 'File written successfully'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

def delete_file_safe(workspace_root: str, rel_path: str, dry_run: bool = True) -> dict:
    if not _is_safe_path(workspace_root, rel_path):
        return {'ok': False, 'error': 'Path traversal blocked'}
    
    file_path = os.path.join(workspace_root, rel_path)
    if not os.path.isfile(file_path):
        return {'ok': False, 'error': 'File not found'}
    
    if dry_run:
        return {'ok': True, 'message': 'Dry run: file would be deleted'}
    
    try:
        os.remove(file_path)
        return {'ok': True, 'message': 'File deleted successfully'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

def list_workspace_files(workspace_root: str, max_files: int = 100) -> dict:
    if not os.path.isdir(workspace_root):
        return {'ok': False, 'error': 'Workspace root is not a directory'}
    
    try:
        files = [str(f) for f in pathlib.Path(workspace_root).glob('**/*') if f.is_file()]
        return {'ok': True, 'files': files[:max_files]}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

def execute(action: str, **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    if action == "read_file_lines":
        return read_file_lines(**kwargs)
    elif action == "write_file_safe":
        return write_file_safe(**kwargs)
    elif action == "delete_file_safe":
        return delete_file_safe(**kwargs)
    elif action == "list_workspace_files":
        return list_workspace_files(**kwargs)
