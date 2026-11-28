import pytest
import os
import tempfile
from unittest.mock import patch
from skill_diff_backup_sync import execute, TOOL_SCHEMA

@pytest.fixture
def temp_files():
    with tempfile.TemporaryDirectory() as tmpdir:
        file_a = os.path.join(tmpdir, 'file_a.txt')
        file_b = os.path.join(tmpdir, 'file_b.txt')
        with open(file_a, 'w') as f:
            f.write("Line 1\nLine 2\n")
        with open(file_b, 'w') as f:
            f.write("Line 1\nLine 3\n")
        yield file_a, file_b

@pytest.fixture
def temp_dirs():
    with tempfile.TemporaryDirectory() as src_dir, tempfile.TemporaryDirectory() as dst_dir:
        sub_dir = os.path.join(src_dir, 'subdir')
        os.makedirs(sub_dir)
        file_a = os.path.join(sub_dir, 'file_a.txt')
        file_b = os.path.join(sub_dir, 'file_b.txt')
        with open(file_a, 'w') as f:
            f.write("Line 1\nLine 2\n")
        with open(file_b, 'w') as f:
            f.write("Line 1\nLine 3\n")
        yield src_dir, dst_dir

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_diff_backup_sync"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA

def test_diff_files(temp_files):
    file_a, file_b = temp_files
    result = execute(action="diff_files", file_a=file_a, file_b=file_b)
    assert result["ok"]
    assert len(result["diff"]) > 0

def test_compare_dirs(temp_dirs):
    src_dir, dst_dir = temp_dirs
    result = execute(action="compare_dirs", src_dir=src_dir, dst_dir=dst_dir)
    assert result["ok"]
    assert result["added"] == ['subdir']
    assert result["removed"] == []
    assert result["modified"] == []

def test_sync_backup_dry_run(temp_dirs):
    src_dir, dst_dir = temp_dirs
    result = execute(action="sync_backup", src_dir=src_dir, dst_dir=dst_dir, dry_run=True)
    assert result["ok"]
    assert len(result["actions"]) > 0

def test_sync_backup(temp_dirs):
    src_dir, dst_dir = temp_dirs
    result = execute(action="sync_backup", src_dir=src_dir, dst_dir=dst_dir, dry_run=False)
    assert result["ok"]
    assert result["actions"] == "Backup completed"
    assert os.path.exists(os.path.join(dst_dir, 'subdir', 'file_a.txt'))
    assert os.path.exists(os.path.join(dst_dir, 'subdir', 'file_b.txt'))

def test_unknown_action():
    result = execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]
