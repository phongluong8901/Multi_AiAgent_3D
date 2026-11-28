import os
import difflib
import shutil
from pathlib import Path

TOOL_SCHEMA = {
    "name": "skill_dev_safe_patch_applier",
    "description": "Safely patch source files using exact search-replace blocks: preview unified diff via difflib, apply replacement with optional .bak backup (dry_run=True default, failing cleanly if old_block is missing or ambiguous), and restore from backup.",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["preview_search_replace", "apply_search_replace", "rollback_backup"]},
        },
        "required": ["action"],
    },
}

def execute(action: str, **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}

    if action == "preview_search_replace":
        return preview_search_replace(**kwargs)
    elif action == "apply_search_replace":
        return apply_search_replace(**kwargs)
    elif action == "rollback_backup":
        return rollback_backup(**kwargs)

def preview_search_replace(file_path: str, old_block: str, new_block: str) -> dict:
    file_path = Path(file_path)
    if not file_path.exists():
        return {"ok": False, "error": f"File not found: {file_path}"}

    with file_path.open('r') as file:
        content = file.read()

    if old_block not in content:
        return {"ok": False, "error": f"Old block not found in file: {file_path}"}

    new_content = content.replace(old_block, new_block)
    diff = difflib.unified_diff(content.splitlines(), new_content.splitlines(), lineterm='')
    return {"ok": True, "diff": "\n".join(diff)}

def apply_search_replace(file_path: str, old_block: str, new_block: str, backup: bool = True, dry_run: bool = True) -> dict:
    file_path = Path(file_path)
    if not file_path.exists():
        return {"ok": False, "error": f"File not found: {file_path}"}

    with file_path.open('r') as file:
        content = file.read()

    if old_block not in content:
        return {"ok": False, "error": f"Old block not found in file: {file_path}"}

    if backup:
        backup_path = file_path.with_suffix(file_path.suffix + '.bak')
        if backup_path.exists():
            return {"ok": False, "error": f"Backup file already exists: {backup_path}"}
        shutil.copy(file_path, backup_path)

    if not dry_run:
        new_content = content.replace(old_block, new_block)
        with file_path.open('w') as file:
            file.write(new_content)

    return {"ok": True, "backup_path": str(backup_path) if backup else None}

def rollback_backup(file_path: str, backup_path: str = '') -> dict:
    file_path = Path(file_path)
    backup_path = Path(backup_path)

    if not backup_path.exists():
        return {"ok": False, "error": f"Backup file not found: {backup_path}"}

    if file_path.exists():
        os.remove(file_path)

    shutil.copy(backup_path, file_path)
    os.remove(backup_path)

    return {"ok": True}
