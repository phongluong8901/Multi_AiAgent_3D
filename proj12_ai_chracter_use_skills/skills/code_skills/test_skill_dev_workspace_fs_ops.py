import skill_dev_workspace_fs_ops as mod
import pytest
from pathlib import Path

def test_tool_schema():
    schema = mod.TOOL_SCHEMA
    assert schema["name"] == "skill_dev_workspace_fs_ops"
    assert schema["risk_level"] == "confirm"
    assert set(schema["parameters"]["properties"]["action"]["enum"]) == {"read_file_lines", "write_file_safe", "delete_file_safe", "list_workspace_files"}

def test_unknown_action(tmp_path):
    result = mod.execute("unknown_action", workspace_root=str(tmp_path))
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_read_file_lines(tmp_path):
    file_path = tmp_path / "test.txt"
    file_path.write_text("Line 1\nLine 2\nLine 3\nLine 4\nLine 5")
    result = mod.execute("read_file_lines", workspace_root=str(tmp_path), rel_path="test.txt", start_line=2, end_line=4)
    assert result == {"ok": True, "content": ["Line 2\n", "Line 3\n", "Line 4\n"]}

def test_write_file_safe(tmp_path):
    result = mod.execute("write_file_safe", workspace_root=str(tmp_path), rel_path="test.txt", content="Hello, World!", dry_run=False)
    assert result == {"ok": True, "message": "File written successfully"}
    assert (tmp_path / "test.txt").read_text() == "Hello, World!"

def test_delete_file_safe(tmp_path):
    file_path = tmp_path / "test.txt"
    file_path.write_text("Hello, World!")
    result = mod.execute("delete_file_safe", workspace_root=str(tmp_path), rel_path="test.txt", dry_run=False)
    assert result == {"ok": True, "message": "File deleted successfully"}
    assert not file_path.exists()
