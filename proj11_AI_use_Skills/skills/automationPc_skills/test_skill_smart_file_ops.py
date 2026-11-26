import skill_smart_file_ops as mod

def test_search_files_default_root_and_custom(tmp_path, monkeypatch):
    (tmp_path / "a.md").write_text("# hi", encoding="utf-8")
    (tmp_path / "b.txt").write_text("txt", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    # Khong truyen root van phai chay OK (fix dung bug vua gap!)
    res = mod.execute("search_files", pattern="*.md")
    assert res["ok"] is True
    assert res["count"] == 1 and res["files"][0].endswith("a.md")

def test_organize_dry_run_returns_plan(tmp_path):
    (tmp_path / "doc.pdf").write_text("x", encoding="utf-8")
    (tmp_path / "pic.png").write_text("y", encoding="utf-8")
    res = mod.execute("organize_by_ext", folder=str(tmp_path), dry_run=True)
    assert res["ok"] is True
    assert res["dry_run"] is True
    assert res["total_files"] == 2
    assert len(res["planned_moves"]) == 2
    assert (tmp_path / "doc.pdf").exists()
