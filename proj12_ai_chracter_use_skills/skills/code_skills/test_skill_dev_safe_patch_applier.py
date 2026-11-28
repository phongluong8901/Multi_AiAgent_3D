import pytest
import skill_dev_safe_patch_applier as mod
from pathlib import Path

def test_tool_schema():
    schema = mod.TOOL_SCHEMA
    assert schema["name"] == "skill_dev_safe_patch_applier"
    assert schema["risk_level"] == "confirm"
    assert schema["parameters"]["properties"]["action"]["enum"] == ["preview_search_replace", "apply_search_replace", "rollback_backup"]

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_preview_search_replace(tmp_path):
    file_path = tmp_path / "testfile.txt"
    file_path.write_text("Hello World\n")
    result = mod.execute("preview_search_replace", file_path=str(file_path), old_block="World", new_block="Universe")
    assert result["ok"] is True
    assert "-Hello World" in result["diff"]
    assert "+Hello Universe" in result["diff"]

def test_apply_search_replace(tmp_path):
    file_path = tmp_path / "testfile.txt"
    file_path.write_text("Hello World\n")
    result = mod.execute("apply_search_replace", file_path=str(file_path), old_block="World", new_block="Universe", backup=True, dry_run=False)
    assert result["ok"] is True
    assert file_path.read_text() == "Hello Universe\n"
    assert Path(result["backup_path"]).exists()

def test_rollback_backup(tmp_path):
    file_path = tmp_path / "testfile.txt"
    backup_path = tmp_path / "testfile.txt.bak"
    file_path.write_text("Hello Universe\n")
    backup_path.write_text("Hello World\n")
    result = mod.execute("rollback_backup", file_path=str(file_path), backup_path=str(backup_path))
    assert result["ok"] is True
    assert file_path.read_text() == "Hello World\n"
    assert not backup_path.exists()
