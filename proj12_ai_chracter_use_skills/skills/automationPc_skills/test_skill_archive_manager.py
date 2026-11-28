import pytest
import os
import zipfile
import tarfile
from unittest.mock import patch, MagicMock
from skill_archive_manager import execute, TOOL_SCHEMA

@pytest.fixture
def sample_zip(tmp_path):
    zip_path = tmp_path / "sample.zip"
    with zipfile.ZipFile(zip_path, 'w') as zip_ref:
        zip_ref.writestr('file1.txt', 'content1')
        zip_ref.writestr('file2.txt', 'content2')
    return zip_path

@pytest.fixture
def sample_tar(tmp_path):
    tar_path = tmp_path / "sample.tar"
    with tarfile.open(tar_path, 'w') as tar_ref:
        file1 = tarfile.TarInfo(name='file1.txt')
        file1.size = len(b'content1')
        tar_ref.addfile(file1, fileobj=MagicMock(read=MagicMock(return_value=b'content1')))
        file2 = tarfile.TarInfo(name='file2.txt')
        file2.size = len(b'content2')
        tar_ref.addfile(file2, fileobj=MagicMock(read=MagicMock(return_value=b'content2')))
    return tar_path

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_archive_manager"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA

def test_execute_list_archive(sample_zip):
    result = execute(action="list_archive", archive_path=str(sample_zip))
    assert result["ok"] is True
    assert set(result["files"]) == {"file1.txt", "file2.txt"}

def test_execute_create_zip(tmp_path):
    source_path = tmp_path / "source"
    source_path.mkdir()
    (source_path / "file1.txt").write_text("content1")
    (source_path / "file2.txt").write_text("content2")
    output_zip = tmp_path / "output.zip"
    result = execute(action="create_zip", source_path=str(source_path), output_zip=str(output_zip))
    assert result["ok"] is True
    with zipfile.ZipFile(output_zip, 'r') as zip_ref:
        assert set(zip_ref.namelist()) == {"file1.txt", "file2.txt"}

def test_execute_extract_zip(sample_zip, tmp_path):
    dest_dir = tmp_path / "dest"
    result = execute(action="extract_archive", archive_path=str(sample_zip), dest_dir=str(dest_dir))
    assert result["ok"] is True
    assert set(os.listdir(dest_dir)) == {"file1.txt", "file2.txt"}

def test_execute_extract_tar(sample_tar, tmp_path):
    dest_dir = tmp_path / "dest"
    result = execute(action="extract_archive", archive_path=str(sample_tar), dest_dir=str(dest_dir))
    assert result["ok"] is True
    assert set(os.listdir(dest_dir)) == {"file1.txt", "file2.txt"}

def test_execute_unknown_action():
    result = execute(action="unknown_action")
    assert result["ok"] is False
    assert "Unknown action" in result["error"]

def test_execute_dry_run_list_archive(sample_zip):
    result = execute(action="list_archive", archive_path=str(sample_zip), dry_run=True)
    assert result["ok"] is True
    assert "Would list contents" in result["preview"]

def test_execute_dry_run_create_zip(tmp_path):
    source_path = tmp_path / "source"
    source_path.mkdir()
    (source_path / "file1.txt").write_text("content1")
    output_zip = tmp_path / "output.zip"
    result = execute(action="create_zip", source_path=str(source_path), output_zip=str(output_zip), dry_run=True)
    assert result["ok"] is True
    assert "Would create ZIP archive" in result["preview"]

def test_execute_dry_run_extract_zip(sample_zip, tmp_path):
    dest_dir = tmp_path / "dest"
    result = execute(action="extract_archive", archive_path=str(sample_zip), dest_dir=str(dest_dir), dry_run=True)
    assert result["ok"] is True
    assert "Would extract" in result["preview"]
