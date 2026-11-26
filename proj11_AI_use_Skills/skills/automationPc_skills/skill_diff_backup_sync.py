import os
import json
import filecmp
import shutil
from difflib import unified_diff

TOOL_SCHEMA = {
    "name": "skill_diff_backup_sync",
    "risk_level": "confirm",
    "description": "Generate unified diffs between two text files, compare two directories (added/removed/modified), and perform one-way backup sync with dry_run. so sánh khác biệt 2 file diff, so sánh 2 thư mục, sao lưu đồng bộ thư mục backup dry_run",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["diff_files", "compare_dirs", "sync_backup"]
            },
            "file_a": {
                "type": "string",
                "description": "Path to the first file"
            },
            "file_b": {
                "type": "string",
                "description": "Path to the second file"
            },
            "src_dir": {
                "type": "string",
                "description": "Source directory path"
            },
            "dst_dir": {
                "type": "string",
                "description": "Destination directory path"
            },
            "dry_run": {
                "type": "boolean",
                "description": "Perform a dry run without making changes",
                "default": True
            }
        },
        "required": ["action"]
    }
}

def execute(action: str = "diff_files", **kwargs) -> dict:
    if action == "diff_files":
        return diff_files(**kwargs)
    elif action == "compare_dirs":
        return compare_dirs(**kwargs)
    elif action == "sync_backup":
        return sync_backup(**kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def diff_files(file_a: str, file_b: str) -> dict:
    try:
        with open(file_a, 'r') as f1, open(file_b, 'r') as f2:
            diff = list(unified_diff(f1.readlines(), f2.readlines(), fromfile=file_a, tofile=file_b))
        return {"ok": True, "diff": diff}
    except FileNotFoundError as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def compare_dirs(src_dir: str, dst_dir: str) -> dict:
    try:
        comparison = filecmp.dircmp(src_dir, dst_dir)
        result = {
            "added": comparison.left_only,
            "removed": comparison.right_only,
            "modified": comparison.diff_files
        }
        return {"ok": True, **result}
    except FileNotFoundError as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def sync_backup(src_dir: str, dst_dir: str, dry_run: bool = True) -> dict:
    try:
        if not os.path.exists(dst_dir):
            if dry_run:
                return {"ok": True, "preview": f"Would create directory: {dst_dir}"}
            os.makedirs(dst_dir)

        actions = []
        for root, dirs, files in os.walk(src_dir):
            for file in files:
                src_file = os.path.join(root, file)
                dst_file = os.path.join(dst_dir, os.path.relpath(src_file, src_dir))
                dst_dir_path = os.path.dirname(dst_file)

                if not os.path.exists(dst_dir_path):
                    if dry_run:
                        actions.append(f"Would create directory: {dst_dir_path}")
                    else:
                        os.makedirs(dst_dir_path)

                if not os.path.exists(dst_file) or os.path.getmtime(src_file) > os.path.getmtime(dst_file):
                    if dry_run:
                        actions.append(f"Would copy: {src_file} to {dst_file}")
                    else:
                        shutil.copy2(src_file, dst_file)

        return {"ok": True, "actions": actions if dry_run else "Backup completed"}
    except FileNotFoundError as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": str(e)}
