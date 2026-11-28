import pytest
import skill_linux_backup_snapshot_ops as mod
from pathlib import Path
import tarfile
import hashlib

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_backup_snapshot_ops"
    assert "description" in mod.TOOL_SCHEMA
    assert mod.TOOL_SCHEMA["risk_level"] == "confirm"
    assert "parameters" in mod.TOOL_SCHEMA

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_create_tar_backup_dry_run(tmp_path):
    source_dir = tmp_path / "source"
    dest_dir = tmp_path / "dest"
    source_dir.mkdir()
    result = mod.create_tar_backup(str(source_dir), str(dest_dir), dry_run=True)
    assert result["ok"]
    assert not list(dest_dir.glob("*.tar.gz"))

def test_create_tar_backup(tmp_path):
    source_dir = tmp_path / "source"
    dest_dir = tmp_path / "dest"
    source_dir.mkdir()
    (source_dir / "file.txt").write_text("test")
    result = mod.create_tar_backup(str(source_dir), str(dest_dir), dry_run=False)
    assert result["ok"]
    assert list(dest_dir.glob("*.tar.gz"))

def test_apply_retention_policy(tmp_path):
    backup_dir = tmp_path / "backups"
    backup_dir.mkdir()
    for i in range(10):
        (backup_dir / f"backup_{i}.tar.gz").touch()
    result = mod.apply_retention_policy(str(backup_dir), keep_last=5, dry_run=False)
    assert result["ok"]
    assert len(list(backup_dir.glob("*.tar.gz"))) == 5

def test_verify_archive_sha256(tmp_path):
    archive_path = tmp_path / "archive.tar.gz"
    with tarfile.open(archive_path, "w:gz") as tar:
        tar.add(tmp_path, arcname=tmp_path.name)
    expected_sha256 = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    result = mod.verify_archive_sha256(str(archive_path), expected_sha256=expected_sha256)
    assert result["ok"]
    assert result["sha256"] == expected_sha256
