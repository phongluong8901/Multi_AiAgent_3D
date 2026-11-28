import pytest
from skill_smart_file_ops import SmartFileOperations


def test_search_files_default_root_and_custom(tmp_path, monkeypatch):
    (tmp_path / "a.md").write_text("# hi", encoding="utf-8")
    (tmp_path / "b.txt").write_text("txt", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    client = SmartFileOperations()
    res = client.execute("search_files", pattern="*.md")
    assert res["ok"] is True
    assert res["count"] == 1 and res["files"][0].endswith("a.md")


def test_organize_dry_run_returns_plan(tmp_path):
    (tmp_path / "doc.pdf").write_text("x", encoding="utf-8")
    (tmp_path / "pic.png").write_text("y", encoding="utf-8")
    client = SmartFileOperations()
    res = client.execute("organize_by_ext", folder=str(tmp_path), dry_run=True)
    assert res["ok"] is True
    assert res["dry_run"] is True
    assert res["total_files"] == 2
    assert len(res["planned_moves"]) == 2
    assert (tmp_path / "doc.pdf").exists()


def test_search_files_missing_directory():
    client = SmartFileOperations()
    res = client.execute("search_files", root="C:\\NonExistentFolder123456789", pattern="*test*")
    assert res["ok"] is False
    assert "Directory not found" in res["error"]


def test_batch_rename_missing_find_str(tmp_path):
    client = SmartFileOperations()
    res = client.execute("batch_rename", folder=str(tmp_path), find_str="", replace_str="new")
    assert res["ok"] is False
    assert "find_str cannot be empty" in res["error"]


def test_unknown_action():
    client = SmartFileOperations()
    res = client.execute("unknown_action_xyz")
    assert res["ok"] is False
    assert "Unknown action" in res["error"]
